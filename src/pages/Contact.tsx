import { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, CheckCircle, Clock, CalendarDays, CalendarPlus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useServiceAreas } from "@/hooks/useServiceAreas";
import { useQuery } from "@tanstack/react-query";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { useNavigate } from "react-router-dom";
import { ADMIN_BASE } from "@/lib/permissions";
import PageMeta from "@/components/PageMeta";

const Contact = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: settings } = useSiteSettings();
  const { data: serviceAreas } = useServiceAreas(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  // Maintained original state + new UI fields
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
    other_details: "",
    preferred_contact: "email",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
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
    setLoading(true);

    try {
      const { data: isRecent } = await supabase.rpc("check_recent_submission", {
        p_email: form.email.trim(),
        p_table: "contact_submissions",
      });
      if (isRecent) {
        setLoading(false);
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        return;
      }
    } catch {
      /* allow submission if rate check fails */
    }

    try {
      // Wrapped in array to satisfy TS2769 overload requirements.
      // Admin notifications are created automatically by a database trigger.
      const { error } = await supabase
        .from("contact_submissions")
        .insert([
          {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            service_type: form.service || null,
            message: form.message.trim(),
          },
        ]);

      if (error) {
        toast({ title: "Message failed to send.", description: "Please try again later.", variant: "destructive" });
        return;
      }


      // Send branded acknowledgement email via Resend (fire-and-forget).
      const html = `
        <p>Hi ${form.name.trim() || "there"},</p>
        <p>Thanks for reaching out to BlueRiver Services. We've received your message and will respond within 24 hours.</p>
        <p>— The BlueRiver Team</p>`;
      Promise.allSettled([
        supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "custom",
            to: form.email.trim(),
            subject: "We received your message - BlueRiver Services",
            html,
          },
        }),
        supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "admin_new_submission",
            to: "info@blueriverservices.co",
            data: {
              kind: "Contact",
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone?.trim(),
              service: form.service,
              message: form.message?.trim(),
              dashboardUrl: `${window.location.origin}${ADMIN_BASE}/messages`,
            },
          },
        }),
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected") console.error(`[admin-email] contact ${i === 0 ? "customer" : "admin"} failed:`, r.reason);
        });
      });

      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
      setSubmitted(true);
      toast({ title: "Message sent!", description: "We'll respond within 24 hours. Check your inbox for a confirmation from info@blueriverservices.co. If you don't see it, please check your spam folder and mark us as a safe sender!" });
    } catch {
      toast({ title: "Message failed to send.", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      // FREEZE FIX: Guaranteed to run
      setLoading(false);
    }
  };

  const update =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const phone = settings?.phone || "(206) 317-8300";
  const phoneLink = settings?.phone_link || "+12063178300";
  const email = settings?.email || "info@blueriverservices.co";
  const serviceArea = settings?.service_area || "Serving Washington State";
  const callAvailability = settings?.call_availability || "7:00 AM – 5:00 PM";
  const businessHoursMF = settings?.business_hours_mf || "Monday – Friday: 7:00 AM – 7:00 PM";
  const businessHoursSat = settings?.business_hours_sat || "Saturday: 8:00 AM – 5:00 PM";
  const businessHoursSun = settings?.business_hours_sun || "Sunday: Closed";

  return (
    <div>
      <PageMeta title="Contact Us" description="Get in touch with BlueRiver Services." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Contact Us</h1>

            {/* NEW CTA BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button onClick={() => navigate("/book")} size="lg" className="gap-2">
                <CalendarPlus className="w-4 h-4" /> Book Now
              </Button>
              <Button onClick={() => navigate("/quote")} variant="outline" size="lg" className="gap-2">
                <FileText className="w-4 h-4" /> Get Quote
              </Button>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              We're here to help you get the best cleaning service in Washington.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
                  <p className="text-muted-foreground">We'll be in touch shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Name *</label>
                      <Input placeholder="Your name" value={form.name} onChange={update("name")} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Email *</label>
                      <Input type="email" placeholder="you@email.com" value={form.email} onChange={update("email")} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Phone</label>
                      <Input type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={update("phone")} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Inquiry Type</label>
                      <select
                        value={form.service}
                        onChange={update("service")}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select type</option>
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Billing Question">Billing Question</option>
                        <option value="Feedback">Feedback</option>
                        <option value="Employment">Employment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* CONDITIONAL "OTHER" FIELD */}
                  <AnimatePresence>
                    {form.service === "Other" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <label className="text-sm font-medium mb-1.5 block">Please specify *</label>
                        <Input
                          placeholder="How can we help?"
                          value={form.other_details}
                          onChange={update("other_details")}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* PREFERRED CONTACT METHOD */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Preferred Contact Method</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="pref"
                          value="email"
                          checked={form.preferred_contact === "email"}
                          onChange={update("preferred_contact")}
                        />{" "}
                        Email
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="pref"
                          value="phone"
                          checked={form.preferred_contact === "phone"}
                          onChange={update("preferred_contact")}
                        />{" "}
                        Phone
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Message *</label>
                    <Textarea
                      placeholder="How can we help?"
                      rows={5}
                      value={form.message}
                      onChange={update("message")}
                    />
                  </div>
                  <Button type="submit" variant="hero" size="lg" disabled={loading || cooldown}>
                    {loading ? "Sending..." : cooldown ? "Please wait..." : "Send Message"}
                  </Button>
                </form>
              )}
            </div>

            {/* SIDE PANELS MAINTAINED FROM ORIGINAL */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h3 className="font-semibold mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <a
                    href={`tel:${phoneLink}`}
                    className="flex items-center gap-3 text-muted-foreground hover:text-primary"
                  >
                    <Phone className="w-5 h-5 text-sky" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Phone</p>
                      <p className="text-sm">{phone}</p>
                    </div>
                  </a>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-muted-foreground hover:text-primary"
                  >
                    <Mail className="w-5 h-5 text-sky" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Email</p>
                      <p className="text-sm">{email}</p>
                    </div>
                  </a>
                  <div className="flex items-start gap-3 text-muted-foreground">
                    <MapPin className="w-5 h-5 text-sky mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Service Area</p>
                      {serviceAreas && serviceAreas.length > 0 ? (
                        <>
                          <p className="text-sm">Serving {serviceAreas[0].city}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cities: {Array.from(new Set(serviceAreas.map((a) => a.city))).join(", ")}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm">{serviceArea}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-sky/50">
                <h4 className="font-semibold mb-3">Business Hours</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{businessHoursMF}</p>
                  <p>{businessHoursSat}</p>
                  <p>{businessHoursSun}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
