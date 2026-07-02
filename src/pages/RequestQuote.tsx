import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useServices } from "@/hooks/useServices";
import imageCompression from "browser-image-compression";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { ADMIN_BASE } from "@/lib/permissions";
import PageMeta from "@/components/PageMeta";
import DynamicField from "@/components/DynamicField";
import { useServiceAreas } from "@/hooks/useServiceAreas";

const COMMERCIAL_PROPERTY_TYPES = ["Office", "Schools", "Medical", "Retail", "Other"];
const RESIDENTIAL_PROPERTY_TYPES = ["House", "Apartment", "Townhome", "Other"];
const RESIDENTIAL_ADDON_PATTERN = /\b(oven|fridge|refrigerator|inside\s+cabinet|laundry|dishwash)/i;
const isCommercialService = (s: string) => /commercial/i.test(s ?? "");
const SERVICE_EXPECTATIONS: Record<string, string> = {
  "standard": "Routine cleaning of all standard rooms — typically 2–3 hrs for an average home.",
  "deep": "Detailed top-to-bottom cleaning. Plan for 4–6 hrs depending on size and condition.",
  "move": "Empty-property turnover, includes inside cabinets and appliances. Allow a half-day.",
  "post-construction": "Heavy debris/dust removal. Requires assessment — final price may vary.",
  "commercial": "Scheduled office/facility cleaning. We'll confirm scope before the first visit.",
  "airbnb": "Fast turnover cleaning between guests, ~1.5–2 hrs typical.",
};
const expectationFor = (name: string): string => {
  const k = (name || "").toLowerCase();
  for (const key of Object.keys(SERVICE_EXPECTATIONS)) if (k.includes(key)) return SERVICE_EXPECTATIONS[key];
  return "We'll review your details and provide a tailored estimate.";
};

// Keys that map to typed columns on quote_requests; everything else goes into custom_fields.
const TYPED_FIELD_KEYS = new Set([
  "bedrooms", "bathrooms", "kitchen_count", "full_bathrooms", "half_bathrooms",
  "living_rooms", "office_rooms", "floor_type", "property_size", "frequency",
  "condition_level", "has_pets", "has_cabinets", "is_empty_property", "entry_codes",
]);

const RequestQuote = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    service: searchParams.get("service") || "",
    service_type_id: "",
    description: "", preferred_contact: "email",
    property_type: "", square_footage: "",
    has_pets: false, pet_count: "", entry_codes: "",
    condition_level: "",
    floor_type: "",
    is_empty_property: false,
    property_type_other: "",
  });
  // Dynamic field values keyed by field_key
  const [dynValues, setDynValues] = useState<Record<string, any>>({});

  const { mainServices, addons } = useServices();
  const { data: serviceAreas } = useServiceAreas(true);

  // Resolve selected service_type_id by name match
  const { data: serviceTypes } = useQuery({
    queryKey: ["public-service-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_types").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve selected service_type_id: prefer explicit id from form, else fallback by name
  const matchedServiceType =
    (form.service_type_id
      ? (serviceTypes ?? []).find((s: any) => s.id === form.service_type_id)
      : undefined) ||
    (serviceTypes ?? []).find((s: any) => s.name.toLowerCase() === form.service.toLowerCase());

  const { data: serviceFields } = useQuery({
    queryKey: ["public-service-fields", matchedServiceType?.id],
    queryFn: async () => {
      if (!matchedServiceType?.id) return [];
      const { data, error } = await (supabase as any)
        .from("service_fields")
        .select("*")
        .eq("service_type_id", matchedServiceType.id)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!matchedServiceType?.id,
  });

  // Phase 2: pricing multipliers preloaded for any future live-estimate hookup on this page.
  useQuery({
    queryKey: ["public-pricing-multipliers"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pricing_multipliers")
        .select("*")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const setDyn = (key: string, val: any) => setDynValues((p) => ({ ...p, [key]: val }));

  const toggleAddon = (title: string) => {
    setSelectedAddons((prev) => prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File must be under 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let fileToUpload: File | Blob = file;
      if (file.type.startsWith("image/")) {
        fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      }
      const ext = file.name.split(".").pop();
      const fileName = `quotes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      // Uploaded to a PRIVATE bucket. Only staff can open it via signed URLs.
      const { error } = await supabase.storage.from("quote-attachments").upload(fileName, fileToUpload);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        // Store the storage path (not a public URL) on the quote record.
        setAttachmentUrl(fileName);
        // Local preview only — no network read required.
        setAttachmentPreview(file.type.startsWith("image/") ? URL.createObjectURL(fileToUpload) : "");
        toast({ title: "File uploaded successfully" });
      }

    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.description.trim()) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!isValidEmail(form.email)) {
      toast({ title: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (form.phone.trim() && !isValidUSPhone(form.phone)) {
      toast({ title: "Please enter a valid US phone number.", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Please agree to be contacted.", variant: "destructive" });
      return;
    }
    // Required dynamic fields
    for (const f of (serviceFields ?? [])) {
      if (f.required) {
        const v = dynValues[f.field_key];
        if (v === undefined || v === null || v === "" || (f.input_type === "number" && Number(v) <= 0)) {
          toast({ title: `Please fill in: ${f.label}`, variant: "destructive" });
          return;
        }
      }
    }
    setLoading(true);

    try {
      const { data: isRecent } = await supabase.rpc("check_recent_submission", { p_email: form.email.trim(), p_table: "quote_requests" });
      if (isRecent) {
        setLoading(false);
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        return;
      }
    } catch { /* allow quote if rate check fails */ }

    // Split dynamic values into typed columns vs custom_fields
    const typedPayload: Record<string, any> = {};
    const customFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(dynValues)) {
      if (v === undefined || v === null || v === "") continue;
      if (TYPED_FIELD_KEYS.has(k)) {
        // numeric typed columns
        if (["bedrooms", "bathrooms", "kitchen_count", "full_bathrooms", "half_bathrooms", "living_rooms", "office_rooms"].includes(k)) {
          const n = parseInt(String(v), 10);
          typedPayload[k] = Number.isFinite(n) ? n : null;
        } else if (["has_pets", "has_cabinets", "is_empty_property"].includes(k)) {
          typedPayload[k] = !!v;
        } else {
          typedPayload[k] = String(v);
        }
      } else {
        customFields[k] = v;
      }
    }

    try {
      const petCountNum = form.has_pets && form.pet_count ? parseInt(form.pet_count, 10) : null;
      const { error } = await supabase.from("quote_requests").insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        service_type: form.service || null,
        service_type_id: matchedServiceType?.id ?? null,
        description: form.description.trim(),
        preferred_contact: form.preferred_contact,
        attachment_url: attachmentUrl || null,
        consent_given: consent,
        property_type: form.property_type === "Other" && form.property_type_other.trim()
          ? `Other: ${form.property_type_other.trim()}`
          : (form.property_type || null),
        square_footage: form.square_footage || null,
        floor_type: form.floor_type || null,
        condition_level: form.condition_level || null,
        is_empty_property: form.is_empty_property,
        has_pets: form.has_pets,
        pet_count: Number.isFinite(petCountNum as number) ? petCountNum : null,
        entry_codes: form.entry_codes.trim() || null,
        selected_addons: selectedAddons.map((title) => ({ title })),
        custom_fields: customFields,
        status: "requested",
        ...typedPayload,
      } as any);

      if (error) {
        const anyErr = error as any;
        const desc = `${anyErr.message ?? "Unknown error"}${anyErr.details ? ` — ${anyErr.details}` : ""}${anyErr.hint ? ` (hint: ${anyErr.hint})` : ""}${anyErr.code ? ` [code ${anyErr.code}]` : ""}`;
        console.error("Quote insert failed:", error);
        toast({ title: "Quote submission failed", description: desc, variant: "destructive" });
        return;
      }

      // Admin notification is created automatically by a database trigger.


      // Fire-and-forget: customer ack + admin alert.
      const quoteData = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim(),
        service: form.service,
        address: form.address.trim(),
        message: form.description?.trim?.(),
      };
      Promise.allSettled([
        supabase.functions.invoke("send-transactional-email", {
          body: { type: "quote_received", to: form.email.trim(), data: quoteData },
        }),
        supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "admin_new_submission",
            to: "info@blueriverservices.co",
            data: { ...quoteData, kind: "Quote", dashboardUrl: `${window.location.origin}${ADMIN_BASE}/quotes` },
          },
        }),
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected") console.error(`[admin-email] quote ${i === 0 ? "customer" : "admin"} failed:`, r.reason);
        });
      });

      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);

      setSubmitted(true);
      toast({ title: "Quote received!", description: "Expect a reply within 24 hours. Check your inbox for a confirmation from info@blueriverservices.co. If you don't see it, please check your spam folder and mark us as a safe sender!" });
    } catch (e: any) {
      console.error("Quote submit threw:", e);
      toast({ title: "Quote submission failed", description: e?.message ?? String(e) ?? "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const isFormValid = form.name.trim() && form.email.trim() && form.description.trim() && consent;

  return (
    <div>
      <PageMeta title="Request a Quote" description="Get a free estimate for your cleaning needs. Tell us about your space and we'll provide a customised quote." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">Free Estimate</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Request a Quote</h1>
            <p className="text-muted-foreground leading-relaxed">Tell us about your cleaning needs and we'll provide a customised estimate.</p>
            <p className="text-sm text-muted-foreground mt-2">We'll get back to you within 24 hours.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground mb-2">Thank You!</h3>
                <p className="text-muted-foreground">We've received your quote request and will be in touch within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                    <Input placeholder="Your name" value={form.name} onChange={update("name")} maxLength={100} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                    <Input type="email" placeholder="you@email.com" value={form.email} onChange={update("email")} maxLength={255} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                    <Input type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={update("phone")} maxLength={20} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Preferred Contact Method</label>
                    <select value={form.preferred_contact} onChange={update("preferred_contact")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="either">Either</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Address</label>
                  <Input placeholder="Service address" value={form.address} onChange={update("address")} maxLength={300} />
                  {serviceAreas && serviceAreas.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Serving {Array.from(new Set(serviceAreas.map((a) => a.city))).join(", ")}
                    </p>
                  )}
                </div>

                {/* Service Type — drives the form */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Service Type *</label>
                  <select
                    value={form.service_type_id || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const st = (serviceTypes ?? []).find((s: any) => s.id === id);
                      const name = st?.name ?? "";
                      setForm((prev) => ({ ...prev, service_type_id: id, service: name }));
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select a service</option>
                    {(serviceTypes ?? []).map((st: any) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  {!form.service && (
                    <p className="text-xs text-muted-foreground mt-1.5">Choose a service to see relevant details.</p>
                  )}
                  {form.service && (
                    <p className="text-xs text-muted-foreground mt-1.5"><strong>What to expect:</strong> {expectationFor(form.service)}</p>
                  )}
                </div>

                {form.service && (
                  <>
                    {/* Property & Conditions — standardized industry fields */}
                    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Property & Conditions</h3>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Property Type</label>
                          <select value={form.property_type} onChange={update("property_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <option value="">Select type</option>
                            {(isCommercialService(form.service) ? COMMERCIAL_PROPERTY_TYPES : RESIDENTIAL_PROPERTY_TYPES).map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          {form.property_type === "Other" && (
                            <Input
                              className="mt-2"
                              placeholder="Please specify property type"
                              value={form.property_type_other}
                              onChange={update("property_type_other")}
                              maxLength={100}
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Approx. Sq Ft</label>
                          <Input type="number" inputMode="numeric" placeholder="e.g. 1500" value={form.square_footage} onChange={update("square_footage")} maxLength={10} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Floor Type</label>
                          <select value={form.floor_type} onChange={update("floor_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <option value="">Select floor</option>
                            <option value="Hardwood">Hardwood</option>
                            <option value="Carpet">Carpet</option>
                            <option value="Tile">Tile</option>
                            <option value="Mixed">Mixed</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Condition Level</label>
                          <select value={form.condition_level} onChange={update("condition_level")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <option value="">Select condition</option>
                            <option value="Light">Light</option>
                            <option value="Standard">Standard</option>
                            <option value="Heavy">Heavy</option>
                            <option value="Post-Construction">Post-Construction</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Occupancy</label>
                          <select
                            value={form.is_empty_property ? "empty" : "occupied"}
                            onChange={(e) => setForm((f) => ({ ...f, is_empty_property: e.target.value === "empty" }))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <option value="occupied">Occupied</option>
                            <option value="empty">Empty (Move-out)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic admin-defined fields */}
                    {(serviceFields ?? []).length > 0 && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Service Details</h3>
                        <div className="grid sm:grid-cols-3 gap-5">
                          {(serviceFields ?? []).map((f: any) => (
                            <DynamicField
                              key={f.id}
                              field={f}
                              value={dynValues[f.field_key]}
                              onChange={(v) => setDyn(f.field_key, v)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pets + Entry instructions — hidden for Commercial services */}
                    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Additional Info</h3>
                      {!isCommercialService(form.service) && (
                        <>
                          <div className="flex items-center gap-2">
                            <Checkbox id="quote-pets" checked={form.has_pets} onCheckedChange={(v) => setForm((f) => ({ ...f, has_pets: !!v, pet_count: v ? f.pet_count : "" }))} />
                            <label htmlFor="quote-pets" className="text-sm font-medium text-foreground cursor-pointer">Pets in home</label>
                          </div>
                          {form.has_pets && (
                            <div>
                              <label className="text-sm font-medium text-foreground mb-1.5 block">Number of Pets</label>
                              <Input type="number" inputMode="numeric" min={1} placeholder="e.g. 2" value={form.pet_count} onChange={update("pet_count")} className="max-w-[140px]" />
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Entry Codes / Key Location</label>
                        <Textarea placeholder="Gate code, lockbox combo, where to find the key, etc." rows={2} value={form.entry_codes} onChange={update("entry_codes")} maxLength={300} />
                      </div>
                    </div>
                  </>
                )}

                {/* Add-ons — residential add-ons hidden for Commercial services */}
                {form.service && (() => {
                  const visible = isCommercialService(form.service)
                    ? addons.filter((a) => !RESIDENTIAL_ADDON_PATTERN.test(a.title))
                    : addons;
                  if (!visible.length) return null;
                  return (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Interested in Add-Ons? (optional)</label>
                      <p className="text-xs text-muted-foreground mb-3">Select any extras you'd like us to consider. Final pricing will be provided in your quote.</p>
                      <div className="space-y-2">
                        {visible.map((a) => (
                          <label key={a.title} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAddons.includes(a.title) ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                            <Checkbox checked={selectedAddons.includes(a.title)} onCheckedChange={() => toggleAddon(a.title)} />
                            <span className="text-sm font-medium text-foreground">{a.title}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Final price may vary based on on-site assessment of size, condition, and scope.</p>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Description of Request *</label>
                  <Textarea placeholder="Describe your cleaning needs, size of space, frequency, etc..." rows={5} value={form.description} onChange={update("description")} maxLength={2000} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Attach Photo (optional)</label>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <span><Upload className="w-4 h-4 mr-2" /> {uploading ? "Uploading..." : attachmentUrl ? "Change Photo" : "Upload Photo"}</span>
                    </Button>
                  </label>
                  {attachmentPreview && (
                    <img src={attachmentPreview} alt="Attachment" className="mt-2 w-24 h-24 rounded-lg object-cover border border-border" />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="quote-consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                  <label htmlFor="quote-consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    I agree to be contacted regarding my request. My information will be kept private.
                  </label>
                </div>
                <Button type="submit" variant="hero" size="lg" disabled={loading || cooldown || !isFormValid} className="w-full sm:w-auto">
                  {loading ? "Submitting..." : cooldown ? "Please wait..." : "Request a Quote"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default RequestQuote;
