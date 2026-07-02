import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Sparkles, Clock, HeartHandshake, DollarSign, Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { sendApplicationAcknowledgement } from "@/lib/applicantEmail";

import PageMeta from "@/components/PageMeta";

const SERVICE_OPTIONS = [
  "House Cleaning Only",
  "Roof Cleaning Only",
  "Both House & Roof Cleaning",
] as const;

const MAX_BIO_WORDS = 300;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const applicationSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  middle_name: z.string().trim().max(60).optional(),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().min(7, "Please enter a valid phone").max(30),
  address_street: z.string().trim().min(3, "Street address is required").max(200),
  address_city: z.string().trim().min(2, "City is required").max(100),
  address_state: z.string().trim().min(2, "State is required").max(60),
  availability: z.string().min(1, "Please select your availability"),
  experience: z.string().min(1, "Please select your experience level"),
  service_type: z.enum(SERVICE_OPTIONS, { errorMap: () => ({ message: "Please choose a service type" }) }),
  has_license: z.enum(["yes", "no"], { errorMap: () => ({ message: "Please select an option" }) }),
  authorized_to_work: z.enum(["yes", "no"], { errorMap: () => ({ message: "Please select an option" }) }),
  reference_1: z.string().trim().min(3, "Reference is required").max(255),
  reference_2: z.string().trim().min(3, "Reference is required").max(255),
  personality_bio: z
    .string()
    .trim()
    .min(1, "Please describe your personality")
    .refine((v) => countWords(v) <= MAX_BIO_WORDS, `Please keep this under ${MAX_BIO_WORDS} words`),
});

// Resume upload constraints
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"];

const COOLDOWN_KEY = "cleaner_application_last_submit";
const COOLDOWN_MS = 30_000;

const initialForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone: "",
  address_street: "",
  address_city: "",
  address_state: "",
  availability: "",
  experience: "",
  service_type: "" as (typeof SERVICE_OPTIONS)[number] | "",
  has_license: "" as "yes" | "no" | "",
  authorized_to_work: "" as "yes" | "no" | "",
  reference_1: "",
  reference_2: "",
  personality_bio: "",
};

const BecomeACleaner = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resume, setResume] = useState<File | null>(null);

  const update = (key: keyof typeof initialForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setResume(null);
      return;
    }
    const nameLower = file.name.toLowerCase();
    const extOk = ALLOWED_RESUME_EXT.some((ext) => nameLower.endsWith(ext));
    const typeOk = ALLOWED_RESUME_TYPES.includes(file.type) || extOk;
    if (!typeOk) {
      setErrors((p) => ({ ...p, resume: "Please upload a PDF, DOC, or DOCX file." }));
      setResume(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setErrors((p) => ({ ...p, resume: "Resume must be 5MB or smaller." }));
      setResume(null);
      e.target.value = "";
      return;
    }
    setErrors((p) => {
      const { resume, ...rest } = p;
      return rest;
    });
    setResume(file);
  };

  const bioWordCount = useMemo(() => countWords(form.personality_bio), [form.personality_bio]);
  const bioOverLimit = bioWordCount > MAX_BIO_WORDS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    if (last && Date.now() - last < COOLDOWN_MS) {
      toast({ title: "Please wait a moment before submitting again.", variant: "destructive" });
      return;
    }

    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      toast({ title: "Please fix the highlighted fields.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(parsed.data.email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }
    if (!isValidUSPhone(parsed.data.phone)) {
      setErrors({ phone: "Please enter a valid US phone number" });
      return;
    }

    setErrors({});
    setLoading(true);

    const fullName = [parsed.data.first_name, parsed.data.middle_name, parsed.data.last_name]
      .filter(Boolean)
      .join(" ");

    const fullAddress = [parsed.data.address_street, parsed.data.address_city, parsed.data.address_state]
      .filter(Boolean)
      .join(", ");

    try {
      // Upload the resume to the private bucket first (optional).
      let resumeUrl: string | null = null;
      if (resume) {
        const ext = resume.name.split(".").pop()?.toLowerCase() || "pdf";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `applications/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("cleaner-resumes")
          .upload(path, resume, { contentType: resume.type || undefined, upsert: false });
        if (uploadError) {
          toast({ title: "Could not upload your resume.", description: "Please try again or submit without it.", variant: "destructive" });
          setLoading(false);
          return;
        }
        resumeUrl = path;
      }

      const { error } = await supabase
        .from("cleaner_applications" as any)
        .insert([
          {
            full_name: fullName,
            middle_name: parsed.data.middle_name || null,
            email: parsed.data.email,
            phone: parsed.data.phone,
            address: fullAddress,
            resume_url: resumeUrl,
            availability: parsed.data.availability,
            experience: parsed.data.experience,
            service_type: parsed.data.service_type,
            has_license: parsed.data.has_license === "yes",
            authorized_to_work: parsed.data.authorized_to_work === "yes",
            reference_1: parsed.data.reference_1,
            reference_2: parsed.data.reference_2,
            personality_bio: parsed.data.personality_bio,
            message: parsed.data.personality_bio,
          },
        ] as any);

      if (error) {
        toast({ title: "Could not submit application.", description: "Please try again shortly.", variant: "destructive" });
        return;
      }

      // Admin notification is created automatically by a database trigger.
      // Send the applicant an auto-acknowledgement (non-blocking).
      sendApplicationAcknowledgement(parsed.data.email, parsed.data.first_name).catch((err) =>
        console.error("[applicant-ack] failed:", err),
      );

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setSubmitted(true);
      toast({ title: "Application submitted!", description: "Check your inbox for a confirmation from info@blueriverservices.co. Our team will review your profile and get back to you shortly." });
    } catch {
      toast({ title: "Something went wrong.", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Become a Cleaner | BlueRiver Services"
        description="Join the BlueRiver Services cleaning team. Flexible schedule, fair pay, and a supportive crew. Apply today."
      />

      {/* Hero */}
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" /> We're hiring
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
              Join Our Cleaning Team
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Build a flexible career with BlueRiver Services. We're looking for reliable, detail-oriented
              cleaners who take pride in their work.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why join */}
      <section className="py-12">
        <div className="container">
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Clock, title: "Flexible Schedule", body: "Full-time, part-time, weekends — pick the shifts that fit your life." },
              { icon: DollarSign, title: "Fair, Reliable Pay", body: "Competitive rates with consistent weekly work across Washington." },
              { icon: HeartHandshake, title: "Supportive Team", body: "A friendly crew, clear expectations, and the tools you need to succeed." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <Icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="pb-24">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-10 text-center"
              >
                <CheckCircle className="w-14 h-14 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Application Submitted Successfully!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Our team will review your profile and get back to you shortly.
                </p>
                <Button onClick={() => navigate("/")} variant="hero" size="lg">
                  Back to Home
                </Button>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5"
                noValidate
              >
                {/* Name */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input id="first_name" value={form.first_name} onChange={update("first_name")} className="mt-1.5" />
                    {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input id="middle_name" value={form.middle_name} onChange={update("middle_name")} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input id="last_name" value={form.last_name} onChange={update("last_name")} className="mt-1.5" />
                    {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
                  </div>
                </div>

                {/* Contact */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={form.email} onChange={update("email")} placeholder="you@email.com" className="mt-1.5" />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" value={form.phone} onChange={update("phone")} placeholder="(555) 123-4567" className="mt-1.5" />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address_street">Street Address *</Label>
                    <Input id="address_street" value={form.address_street} onChange={update("address_street")} placeholder="123 Main St, Apt 4" className="mt-1.5" />
                    {errors.address_street && <p className="text-xs text-destructive mt-1">{errors.address_street}</p>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="address_city">City *</Label>
                      <Input id="address_city" value={form.address_city} onChange={update("address_city")} placeholder="Seattle" className="mt-1.5" />
                      {errors.address_city && <p className="text-xs text-destructive mt-1">{errors.address_city}</p>}
                    </div>
                    <div>
                      <Label htmlFor="address_state">State *</Label>
                      <Input id="address_state" value={form.address_state} onChange={update("address_state")} placeholder="WA" className="mt-1.5" />
                      {errors.address_state && <p className="text-xs text-destructive mt-1">{errors.address_state}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="availability">Availability *</Label>
                    <select
                      id="availability"
                      value={form.availability}
                      onChange={update("availability")}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select availability…</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Weekdays">Weekdays</option>
                      <option value="Weekends">Weekends</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                    {errors.availability && <p className="text-xs text-destructive mt-1">{errors.availability}</p>}
                  </div>
                  <div>
                    <Label htmlFor="experience">Years of Cleaning Experience *</Label>
                    <select
                      id="experience"
                      value={form.experience}
                      onChange={update("experience")}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select experience…</option>
                      <option value="None">None — willing to learn</option>
                      <option value="Less than 1 year">Less than 1 year</option>
                      <option value="1-2 years">1–2 years</option>
                      <option value="3-5 years">3–5 years</option>
                      <option value="5+ years">5+ years</option>
                    </select>
                    {errors.experience && <p className="text-xs text-destructive mt-1">{errors.experience}</p>}
                  </div>
                </div>

                {/* Service type */}
                <div>
                  <Label>What type of cleaning services are you applying for? *</Label>
                  <RadioGroup
                    value={form.service_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, service_type: v as (typeof SERVICE_OPTIONS)[number] }))}
                    className="mt-2 space-y-2"
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        htmlFor={`svc-${opt}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2.5 cursor-pointer transition-colors"
                      >
                        <RadioGroupItem value={opt} id={`svc-${opt}`} />
                        <span className="text-sm text-foreground">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.service_type && <p className="text-xs text-destructive mt-1">{errors.service_type}</p>}
                </div>

                {/* Yes/No: License + Work auth */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label>Do you have a Driver's License? *</Label>
                    <RadioGroup
                      value={form.has_license}
                      onValueChange={(v) => setForm((p) => ({ ...p, has_license: v as "yes" | "no" }))}
                      className="mt-2 flex gap-2"
                    >
                      {(["yes", "no"] as const).map((v) => (
                        <label
                          key={v}
                          htmlFor={`lic-${v}`}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2.5 cursor-pointer transition-colors capitalize"
                        >
                          <RadioGroupItem value={v} id={`lic-${v}`} />
                          <span className="text-sm text-foreground">{v}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {errors.has_license && <p className="text-xs text-destructive mt-1">{errors.has_license}</p>}
                  </div>
                  <div>
                    <Label>Authorized to work in the United States? *</Label>
                    <RadioGroup
                      value={form.authorized_to_work}
                      onValueChange={(v) => setForm((p) => ({ ...p, authorized_to_work: v as "yes" | "no" }))}
                      className="mt-2 flex gap-2"
                    >
                      {(["yes", "no"] as const).map((v) => (
                        <label
                          key={v}
                          htmlFor={`auth-${v}`}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2.5 cursor-pointer transition-colors capitalize"
                        >
                          <RadioGroupItem value={v} id={`auth-${v}`} />
                          <span className="text-sm text-foreground">{v}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {errors.authorized_to_work && <p className="text-xs text-destructive mt-1">{errors.authorized_to_work}</p>}
                  </div>
                </div>

                {/* References */}
                <div className="space-y-3">
                  <Label>Professional References *</Label>
                  <div>
                    <Input
                      value={form.reference_1}
                      onChange={update("reference_1")}
                      placeholder="Reference 1 — Current or Former Supervisor (Name & Contact)"
                    />
                    {errors.reference_1 && <p className="text-xs text-destructive mt-1">{errors.reference_1}</p>}
                  </div>
                  <div>
                    <Input
                      value={form.reference_2}
                      onChange={update("reference_2")}
                      placeholder="Reference 2 — Professional Reference (Name & Contact)"
                    />
                    {errors.reference_2 && <p className="text-xs text-destructive mt-1">{errors.reference_2}</p>}
                  </div>
                </div>

                {/* Resume upload (optional) */}
                <div>
                  <Label htmlFor="resume">Resume <span className="text-muted-foreground font-normal">(optional — PDF, DOC, or DOCX, up to 5MB)</span></Label>
                  {resume ? (
                    <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                      <span className="flex items-center gap-2 text-sm text-foreground truncate">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{resume.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setResume(null)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Remove resume"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="resume"
                      className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-border bg-background hover:bg-muted/50 px-3 py-2.5 cursor-pointer transition-colors text-sm text-muted-foreground"
                    >
                      <Upload className="w-4 h-4" /> Attach your resume
                    </label>
                  )}
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeChange}
                    className="hidden"
                  />
                  {errors.resume && <p className="text-xs text-destructive mt-1">{errors.resume}</p>}
                </div>


                {/* Personality bio */}
                <div>
                  <Label htmlFor="personality_bio">Describe your personality in not more than 300 words *</Label>
                  <Textarea
                    id="personality_bio"
                    rows={5}
                    value={form.personality_bio}
                    onChange={update("personality_bio")}
                    placeholder="Tell us what makes you a great fit for our team."
                    className="mt-1.5"
                  />
                  <div className="flex justify-between mt-1">
                    {errors.personality_bio ? (
                      <p className="text-xs text-destructive">{errors.personality_bio}</p>
                    ) : <span />}
                    <p className={`text-xs ${bioOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                      {bioWordCount} / {MAX_BIO_WORDS} words
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={loading || bioOverLimit}
                  className="w-full sm:w-auto"
                >
                  {loading ? "Submitting…" : "Submit Application"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default BecomeACleaner;
