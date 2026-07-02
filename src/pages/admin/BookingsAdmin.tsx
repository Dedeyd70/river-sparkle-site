import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { createInvoiceFromBooking } from "@/lib/createInvoiceFromBooking";
import { notifyAdmins } from "@/lib/notifications";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import { ChevronDown, ChevronUp, Clock, FileText, Send, Receipt as ReceiptIcon, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import PermissionGate from "@/components/PermissionGate";
import { generateInvoicePdf, generateInvoicePdfBase64 } from "@/lib/invoicePdf";

import { useSiteSettings } from "@/hooks/useSiteSettings";
import { friendlyRpcError } from "@/lib/friendlyRpcError";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";
import CollapsibleRecordCard from "@/components/admin/CollapsibleRecordCard";
import { recomputeFromLineItems, LineItem } from "@/lib/pricingEngine";

import { useAdminUserNames } from "@/hooks/useAdminUserNames";


const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  items_modified: "Items modified",
  note: "Note",
};

const logBookingActivity = async (
  bookingId: string,
  action: string,
  options: { details?: string; previous_status?: string; new_status?: string; notes?: string } = {}
) => {
  const { data: { user } } = await supabase.auth.getUser();
  await (supabase as any).from("booking_activity_logs").insert({
    booking_id: bookingId,
    action,
    details: options.details ?? null,
    notes: options.notes ?? null,
    previous_status: options.previous_status ?? null,
    new_status: options.new_status ?? null,
    actor_id: user?.id ?? null,
  });
};

const BookingsAdmin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const focusId = searchParams.get("focus");
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  const [activityNoteByBooking, setActivityNoteByBooking] = useState<Record<string, string>>({});

  // Modify Items dialog state
  const [modifyTarget, setModifyTarget] = useState<any>(null);
  const [modifyItems, setModifyItems] = useState<LineItem[]>([]);
  const { data: siteSettings } = useSiteSettings();


  useEffect(() => {
    if (focusId) setExpandedId(focusId);
  }, [focusId]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  const { data: activityLogs } = useQuery({
    queryKey: ["admin-booking-activity"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_activity_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: invoiceByBooking } = useQuery({
    queryKey: ["admin-invoices-by-booking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((i: any) => {
        if (i.booking_id) map[i.booking_id] = i;
      });
      return map;
    },
  });

  const { data: branding } = useQuery({
    queryKey: ["branding-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("branding_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: pdfSettings } = useQuery({
    queryKey: ["site-settings-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  // Resolve admin actor names via the SECURITY DEFINER RPC
  // get_admin_display_names — works for Manager/Staff too (audit fix §6).
  const { data: adminUserMap } = useAdminUserNames();

  const resolveActor = (id?: string | null): string => {
    if (!id) return "System";
    return adminUserMap?.[id] || "Admin user";
  };

  const { getRef } = useFocusHighlight(!isLoading && !!bookings);

  const isArchived = (b: any) => {
    if (b.status === "cancelled") return true;
    if (b.status === "completed") {
      const inv = invoiceByBooking?.[b.id];
      return inv?.payment_status === "paid";
    }
    return false;
  };
  const activeBookings = (bookings ?? []).filter((b) => {
    if (statusFilter === "pending") return b.status === "pending";
    return !isArchived(b);
  });
  const archivedBookings = (bookings ?? []).filter(isArchived);

  useEffect(() => {
    if (!focusId || !bookings) return;
    const idx = activeBookings.findIndex((b: any) => b.id === focusId);
    if (idx >= 0) {
      setActivePage(Math.floor(idx / PAGE_SIZE) + 1);
      return;
    }
    const archIdx = archivedBookings.findIndex((b: any) => b.id === focusId);
    if (archIdx >= 0) setArchivePage(Math.floor(archIdx / PAGE_SIZE) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, bookings]);

  // ---- Lifecycle handlers ------------------------------------------------

  const handleConfirm = async (b: any) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", b.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
      await logBookingActivity(b.id, "confirmed", { previous_status: b.status, new_status: "confirmed" });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Booking confirmed.", description: "Confirmation email sent to customer." });

      // Send branded confirmation email via Resend (fire-and-forget).
      supabase.functions.invoke("send-transactional-email", {
        body: {
          type: "booking_confirmed",
          to: b.email,
          data: {
            name: b.name,
            service: b.service_type || "your booking",
            date: b.booking_date ? format(new Date(b.booking_date), "MMMM d, yyyy") : null,
            timeSlot: b.time_slot,
            address: b.address,
            total: b.total_amount,
          },
        },
      }).catch((err) => console.error("Booking confirmation email failed:", err));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCompleted = async (b: any) => {
    try {
      const { data: updData, error: updErr } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", b.id)
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updData) throw new Error("Update blocked by permissions or RLS");

      // Phase C: invoice generation is decoupled from completion.
      // 'Mark Completed' now only updates status + sends review email.
      await logBookingActivity(b.id, "completed", {
        previous_status: b.status,
        new_status: "completed",
      });

      await notifyAdmins(
        "booking_completed",
        `Booking for ${b.name} marked completed.`,
        b.id,
        "booking"
      );

      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Booking marked completed. Use Generate Invoice when ready to bill." });

      // Fire-and-forget: ask the customer for a review
      if (b.email) {
        const reviewLink = `${window.location.origin}/review/${b.id}?email=${encodeURIComponent(b.email)}`;
        const serviceLabel = b.service_type || "cleaning";
        const dateLabel = b.booking_date ? format(new Date(b.booking_date), "MMM d, yyyy") : null;
        const reviewSubject = `How was your BlueRiver ${serviceLabel}${dateLabel ? ` on ${dateLabel}` : ""}?`;
        const reviewHtml = `
          <p>Hi ${b.name || "there"},</p>
          <p>Thanks for choosing BlueRiver Services for your <strong>${serviceLabel}</strong>${dateLabel ? ` on <strong>${dateLabel}</strong>` : ""}! We'd love to hear how it went.</p>
          <p style="margin:20px 0;"><a href="${reviewLink}" style="background:#1e40af;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Leave a Review</a></p>
          <p>It only takes a minute and really helps our small team.</p>
          <p>— The BlueRiver Team</p>
          <p style="font-size:12px;color:#94a3b8;margin-top:24px;">Prefer not to receive review or marketing emails? Reply <strong>UNSUBSCRIBE</strong> to this message and we'll remove you.</p>`;
        supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "custom",
            to: b.email,
            subject: reviewSubject,
            html: reviewHtml,
          },
        }).catch((err) => console.error("Review request email failed:", err));
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      const updates: any = { status: "cancelled" };
      if (cancelReason) updates.cancellation_reason = cancelReason;
      const { data, error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", cancelTarget.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
      await logBookingActivity(cancelTarget.id, "cancelled", {
        previous_status: cancelTarget.status,
        new_status: "cancelled",
        details: cancelReason || undefined,
      });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: `Booking cancelled. ${cancelReason ? `Reason: ${cancelReason}` : ""}` });
      setCancelTarget(null);
      setCancelReason("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const parseAddons = (addons: any): { title: string; price?: number }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

  const getActivityFor = (bookingId: string) =>
    (activityLogs ?? []).filter((l) => l.booking_id === bookingId);

  // ---- Invoice action handlers ----

  const handleGenerateInvoice = async (b: any) => {
    try {
      const invoice = await createInvoiceFromBooking(b, user?.id);
      qc.invalidateQueries({ queryKey: ["admin-invoices-by-booking"] });
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast({ title: `Invoice ${invoice?.invoice_number ?? ""} created.` });
    } catch (e: any) {
      toast({ title: "Error", description: friendlyRpcError(e), variant: "destructive" });
    }
  };

  const handleViewInvoice = async (inv: any, b?: any) => {
    if (!branding || !pdfSettings) {
      toast({ title: "Loading branding…", description: "Please try again in a moment." });
      return;
    }
    await generateInvoicePdf(inv, branding, pdfSettings);
    if (b?.id) {
      await logBookingActivity(b.id, "note", {
        notes: `Invoice ${inv.invoice_number ?? ""} PDF downloaded`,
      });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
    }
  };

  const handleSendInvoice = async (inv: any, b: any) => {
    if (!branding || !pdfSettings) {
      toast({ title: "Loading branding…", description: "Please try again in a moment." });
      return;
    }
    const recipient = inv.customer_email || b?.email;
    const customerName = inv.customer_name || b?.name || "there";
    // Defensive fallback: if persisted total is 0, recompute from line_items.
    let totalNum = Number(inv.total_amount ?? 0);
    if (!totalNum || totalNum <= 0) {
      const items: any[] = Array.isArray(inv.line_items) ? inv.line_items : [];
      totalNum = items.reduce((sum, li: any) => {
        const qty = Number(li?.quantity) || 1;
        const unit = Number(li?.unit_price ?? li?.price) || 0;
        return sum + (Number(li?.total_price) || qty * unit);
      }, 0);
    }
    const total = totalNum.toFixed(2);
    const isPaid = inv.payment_status === "paid";
    const docLabel = isPaid ? "Receipt" : "Invoice";
    const subject = isPaid
      ? `Receipt for your cleaning service — ${inv.invoice_number ?? ""}`
      : `Invoice ${inv.invoice_number ?? ""} from BlueRiver Services`;
    const paymentInstructions =
      pdfSettings?.payment_methods ||
      "Pay via Zelle to info@blueriverservices.co. Cash also accepted on-site.";
    const html = `
      <p>Hi ${customerName},</p>
      <p>Thank you for choosing BlueRiver Services. Your ${docLabel.toLowerCase()} <strong>${inv.invoice_number ?? ""}</strong> is attached as a PDF.</p>
      <p><strong>${isPaid ? "Amount paid" : "Amount due"}:</strong> $${total}</p>
      ${isPaid ? "" : `
      <h3 style="margin:20px 0 6px;color:#1e40af;">Payment Instructions</h3>
      <p style="margin:0 0 4px;">${paymentInstructions}</p>
      <p style="margin:0 0 16px;">Memo: Invoice #${inv.invoice_number ?? ""}</p>`}
      <p>Please reply to this email if you have any questions.</p>
      <p>— The BlueRiver Team</p>`;
    try {
      const { filename, base64 } = await generateInvoicePdfBase64(inv, branding, pdfSettings);
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          type: "custom",
          to: recipient,
          subject,
          html,
          attachments: [{ filename, content: base64 }],
        },
      });
      if (error) throw error;
      toast({ title: `${docLabel} emailed`, description: `Sent to ${recipient}` });
      if (b?.id) {
        await logBookingActivity(b.id, "note", {
          notes: `${docLabel} ${inv.invoice_number ?? ""} sent to ${recipient}`,
        });
        qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      }
    } catch (err) {
      console.error("Invoice email failed:", err);
      toast({
        title: "Failed to send email with attachment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Mark Paid removed from Bookings — payments are recorded only in InvoicesAdmin (single source of truth).

  const openReschedule = (b: any) => {
    setRescheduleTarget(b);
    setRescheduleDate(b.booking_date ?? "");
    setRescheduleSlot(b.time_slot ?? "");
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSlot) return;
    // Date Guard: reject any date earlier than today (No Backdating).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const proposed = new Date(`${rescheduleDate}T00:00:00`);
    if (isNaN(proposed.getTime()) || proposed < today) {
      toast({ title: "Invalid date", description: "Bookings cannot be scheduled in the past.", variant: "destructive" });
      return;
    }
    try {
      const { data: bookedSlots } = await (supabase as any).rpc("get_booked_slots", { p_date: rescheduleDate });
      const taken = (bookedSlots ?? []).map((s: any) => s.time_slot);
      const isSameSlot = rescheduleTarget.booking_date === rescheduleDate && rescheduleTarget.time_slot === rescheduleSlot;
      if (taken.includes(rescheduleSlot) && !isSameSlot) {
        toast({ title: "That time slot is already booked.", variant: "destructive" });
        return;
      }
      // Time-range overlap check (excludes the booking being rescheduled).
      const { data, error } = await supabase
        .from("bookings")
        .update({ booking_date: rescheduleDate, time_slot: rescheduleSlot } as any)
        .eq("id", rescheduleTarget.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
      await logBookingActivity(rescheduleTarget.id, "rescheduled", {
        details: `From ${rescheduleTarget.booking_date} ${rescheduleTarget.time_slot} → ${rescheduleDate} ${rescheduleSlot}`,
      });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Booking rescheduled." });
      setRescheduleTarget(null);
    } catch (e: any) {
      if (e?.code === "23505") {
        toast({
          title: "This slot is already occupied (Confirmed/Completed).",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: friendlyRpcError(e), variant: "destructive" });
      }
    }
  };

  // ---- Add Note ----------------------------------------------------------

  const handleAddNote = async (bookingId: string) => {
    const note = (activityNoteByBooking[bookingId] || "").trim();
    if (!note) return;
    try {
      await logBookingActivity(bookingId, "note", { notes: note });
      setActivityNoteByBooking((prev) => ({ ...prev, [bookingId]: "" }));
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Note added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ---- Modify Items dialog ----------------------------------------------

  const openModify = (b: any) => {
    const linkedInv = invoiceByBooking?.[b.id];
    if (linkedInv && linkedInv.payment_status && linkedInv.payment_status !== "unpaid") {
      toast({
        title: "Invoice already has payments",
        description: "Modify the invoice directly instead of the booking.",
        variant: "destructive",
      });
      return;
    }
    const items: LineItem[] = Array.isArray(b.line_items) && b.line_items.length > 0
      ? b.line_items
      : [];
    setModifyItems(items);
    setModifyTarget(b);
  };

  const updateModifyItem = (idx: number, patch: Partial<LineItem>) => {
    setModifyItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeModifyItem = (idx: number) => {
    setModifyItems((prev) => prev.filter((_, i) => i !== idx));
  };
  const addModifyItem = () => {
    setModifyItems((prev) => [
      ...prev,
      { name: "Custom item", quantity: 1, unit_price: 0, total_price: 0, type: "addon" },
    ]);
  };

  const taxRatePct = useMemo(() => Number(pdfSettings?.tax_rate ?? 0) || 0, [pdfSettings]);
  const modifyPreview = useMemo(
    () => recomputeFromLineItems(modifyItems, taxRatePct),
    [modifyItems, taxRatePct]
  );

  const handleModifySave = async () => {
    if (!modifyTarget) return;
    try {
      const computed = recomputeFromLineItems(modifyItems, taxRatePct);
      const prevTotal = Number(modifyTarget.total_amount ?? modifyTarget.total_price ?? 0);
      const { data, error } = await supabase
        .from("bookings")
        .update({
          line_items: computed.lineItems as any,
          subtotal: computed.subtotal,
          tax_amount: computed.tax,
          total_amount: computed.total,
          total_price: computed.total,
        } as any)
        .eq("id", modifyTarget.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");

      await logBookingActivity(modifyTarget.id, "items_modified", {
        details: `Total: $${prevTotal.toFixed(2)} → $${computed.total.toFixed(2)} (${computed.lineItems.length} line items)`,
      });

      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-invoices-by-booking"] });
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Booking items updated." });
      setModifyTarget(null);
      setModifyItems([]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ---- Card renderer -----------------------------------------------------

  const renderBookingCard = (b: any) => {
    const addons = parseAddons((b as any).selected_addons);
    const totalPrice = (b as any).total_price ?? (b as any).total_amount;
    const isCancelled = b.status === "cancelled";
    const isCompleted = b.status === "completed";
    const archived = isArchived(b);
    const activity = getActivityFor(b.id);
    const isActivityOpen = expandedActivity === b.id;
    const linkedInvoice = invoiceByBooking?.[b.id];
    const showLifecycle = !isCompleted && !isCancelled;
    const showInvoiceActions = !isCancelled;
    const lineItems: LineItem[] = Array.isArray(b.line_items) ? b.line_items : [];

    const paymentPill = linkedInvoice ? (
      linkedInvoice.payment_status === "paid" ? (
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
          Paid
        </span>
      ) : (
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
          Unpaid
        </span>
      )
    ) : null;

    const statusBadge = (
      <div className="flex items-center gap-2">
        {paymentPill}
        {archived && (
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
            Archived
          </span>
        )}
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            isCancelled
              ? "bg-red-50 text-red-500 border-red-100"
              : statusColors[b.status] || "bg-muted text-muted-foreground"
          }`}
        >
          {b.status}
        </span>
      </div>
    );

    return (
      <CollapsibleRecordCard
        key={b.id}
        innerRef={getRef(b.id)}
        title={b.name}
        subtitle={`${b.email}${b.phone ? ` • ${b.phone}` : ""}`}
        statusBadge={statusBadge}
        readOnly={archived}
        expanded={expandedId === b.id}
        onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
        summary={[
          { label: "Date", value: format(new Date(b.booking_date), "MMM d, yyyy") },
          { label: "Time", value: b.time_slot },
          { label: "Service", value: b.service_type || "—" },
          { label: "Submitted", value: format(new Date(b.created_at), "MMM d") },
        ]}
      >
        {b.property_type && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Property:</span> {b.property_type}
            {b.square_footage ? ` · ${b.square_footage} sq ft` : ""}
            {b.bedrooms ? ` · ${b.bedrooms} bed` : ""}
            {b.bathrooms ? ` / ${b.bathrooms} bath` : ""}
            {(b as any).floor_type ? ` · ${(b as any).floor_type}` : ""}
          </p>
        )}

        {((b as any).condition_level || (b as any).is_empty_property) && (
          <p className="text-sm text-muted-foreground">
            {(b as any).condition_level && (
              <>
                <span className="text-foreground font-medium">Condition:</span> {(b as any).condition_level}
              </>
            )}
            {(b as any).is_empty_property && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium">Empty / Move-out</span>
            )}
          </p>
        )}

        {b.frequency && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Frequency:</span> {b.frequency}
          </p>
        )}

        {b.has_pets && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Pets:</span> Yes
            {(b as any).pet_count ? ` (${(b as any).pet_count})` : ""}
          </p>
        )}

        {b.entry_codes && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Entry Codes:</span> {b.entry_codes}
          </p>
        )}

        {addons.length > 0 && (
          <div className="text-sm">
            <span className="text-foreground font-medium">Add-Ons:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {addons.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium"
                >
                  {a.title}
                  {a.price ? ` ($${a.price})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Itemized breakdown */}
        <div className="border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground mb-2">Itemized Breakdown</p>
          {lineItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No itemized data on this booking.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden text-sm">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div className="col-span-7">Item</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-1 text-right">Unit</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {lineItems.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-3 py-1.5 border-t border-border">
                  <div className="col-span-7 truncate">{it.name}</div>
                  <div className="col-span-2 text-right">{it.quantity}</div>
                  <div className="col-span-1 text-right">${Number(it.unit_price).toFixed(0)}</div>
                  <div className="col-span-2 text-right font-medium">${Number(it.total_price).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
          {totalPrice != null && Number(totalPrice) > 0 && (
            <p className="text-sm font-semibold text-primary mt-2">Total: ${Number(totalPrice).toFixed(2)}</p>
          )}
        </div>

        {b.address && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Address:</span> {b.address}
          </p>
        )}

        {b.notes && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Notes:</span> {b.notes}
          </p>
        )}

        {(b as any).cancellation_reason && (
          <div className="mt-2 p-3 bg-red-50/50 border border-red-100/50 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              Cancellation Reason: <span className="font-normal">{(b as any).cancellation_reason}</span>
            </p>
          </div>
        )}

        {/* Activity Log */}
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setExpandedActivity(isActivityOpen ? null : b.id)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <Clock className="w-3.5 h-3.5" /> Activity ({activity.length})
            {isActivityOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isActivityOpen && (
            <div className="mt-3 space-y-2">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
              )}
              {activity.map((entry) => (
                <div key={entry.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        by {resolveActor(entry.actor_id)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                  )}
                  {entry.notes && (
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{entry.notes}</p>
                  )}
                </div>
              ))}

              {/* Add note */}
              <PermissionGate permission="can_manage_bookings">
                <div className="flex gap-2 pt-2">
                  <Textarea
                    rows={2}
                    placeholder="Add a note to this booking…"
                    value={activityNoteByBooking[b.id] || ""}
                    onChange={(e) =>
                      setActivityNoteByBooking((p) => ({ ...p, [b.id]: e.target.value }))
                    }
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddNote(b.id)}
                    disabled={!(activityNoteByBooking[b.id] || "").trim()}
                  >
                    Add note
                  </Button>
                </div>
              </PermissionGate>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(showLifecycle || showInvoiceActions) && (
          <div className="pt-3 border-t border-border/50">
            {isCancelled ? (
              <div className="py-1">
                <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
                  This booking was cancelled and cannot be modified.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {showLifecycle && b.status === "pending" && (
                  <PermissionGate permission="can_manage_bookings">
                    <Button variant="default" size="sm" onClick={() => handleConfirm(b)}>
                      Confirm
                    </Button>
                  </PermissionGate>
                )}
                {showLifecycle && b.status === "confirmed" && !archived && (() => {
                  const canComplete = !!linkedInvoice && linkedInvoice.payment_status === "paid";
                  return (
                    <PermissionGate permission="can_manage_bookings">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canComplete}
                        onClick={() => handleCompleted(b)}
                        title={canComplete
                          ? "Mark this booking as completed and send the review request."
                          : "Generate the invoice and mark it paid before completing."}
                      >
                        Mark Completed
                      </Button>
                    </PermissionGate>
                  );
                })()}

                {showLifecycle && (
                  <PermissionGate permission="can_manage_bookings">
                    <Button variant="outline" size="sm" onClick={() => openReschedule(b)}>
                      <CalendarClock className="w-3 h-3 mr-1" /> Reschedule
                    </Button>
                  </PermissionGate>
                )}

                {/* Modify Items — only when not archived */}
                {!archived && (
                  <PermissionGate permission="can_manage_bookings">
                    <Button variant="outline" size="sm" onClick={() => openModify(b)}>
                      <Pencil className="w-3 h-3 mr-1" /> Modify Items
                    </Button>
                  </PermissionGate>
                )}

                {/* Quote-sourced parity: show Generate Invoice for ALL bookings without an invoice */}
                {!linkedInvoice && (
                  <PermissionGate permission="can_manage_invoices">
                    <Button variant="outline" size="sm" onClick={() => handleGenerateInvoice(b)}>
                      <FileText className="w-3 h-3 mr-1" /> Generate Invoice
                    </Button>
                  </PermissionGate>
                )}
                {linkedInvoice && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleViewInvoice(linkedInvoice, b)}>
                      <FileText className="w-3 h-3 mr-1" /> View Invoice
                    </Button>

                    {/* Send Invoice — disabled when archived (paid + completed) */}
                    {archived ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button variant="outline" size="sm" disabled className="opacity-50">
                              <Send className="w-3 h-3 mr-1" /> Send Invoice
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Booking archived — invoice already settled</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleSendInvoice(linkedInvoice, b)}>
                        <Send className="w-3 h-3 mr-1" /> Send Invoice
                      </Button>
                    )}

                    {linkedInvoice.payment_status === "paid" ? (
                      <Button variant="outline" size="sm" disabled>
                        <ReceiptIcon className="w-3 h-3 mr-1" /> Receipt Generated
                      </Button>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                        Unpaid · manage in Invoices
                      </span>
                    )}
                  </>
                )}

                {showLifecycle && (
                  <PermissionGate permission="can_manage_bookings">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setCancelTarget(b)}
                    >
                      Cancel
                    </Button>
                  </PermissionGate>
                )}
              </div>
            )}
          </div>
        )}
      </CollapsibleRecordCard>
    );
  };

  return (
    <TooltipProvider>
    <div className="pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Bookings</h1>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for cancellation</label>
              <Textarea
                placeholder="Enter reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleTarget} onOpenChange={() => setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New date</label>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New time</label>
              <Input
                type="text"
                placeholder="e.g. 9:00 AM"
                value={rescheduleSlot}
                onChange={(e) => setRescheduleSlot(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter any time. A time is unavailable only if it is already booked for the selected date.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Back
            </Button>
            <Button onClick={handleRescheduleConfirm} disabled={!rescheduleDate || !rescheduleSlot}>
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Items dialog */}
      <Dialog open={!!modifyTarget} onOpenChange={(o) => { if (!o) { setModifyTarget(null); setModifyItems([]); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modify Booking Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Adjust line items below. Totals are recalculated using the pricing engine and saved to the booking.
            </p>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div className="col-span-6">Item</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit ($)</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {modifyItems.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground italic">No line items. Click "Add line" to start.</p>
              )}
              {modifyItems.map((it, idx) => {
                const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-t border-border">
                    <Input
                      className="col-span-6 h-9"
                      value={it.name}
                      onChange={(e) => updateModifyItem(idx, { name: e.target.value })}
                    />
                    <Input
                      type="number" step="1" min="0"
                      className="col-span-2 h-9 text-right"
                      value={it.quantity}
                      onChange={(e) => updateModifyItem(idx, { quantity: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    />
                    <Input
                      type="number" step="1" min="0"
                      className="col-span-2 h-9 text-right"
                      value={it.unit_price}
                      onChange={(e) => updateModifyItem(idx, { unit_price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    />
                    <div className="col-span-1 text-right text-sm font-medium">${lineTotal.toFixed(0)}</div>
                    <Button
                      type="button" size="icon" variant="ghost"
                      onClick={() => removeModifyItem(idx)}
                      className="col-span-1 h-8 w-8 justify-self-end"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Button type="button" size="sm" variant="outline" onClick={addModifyItem} className="h-8 gap-1">
              <Plus className="w-3 h-3" /> Add line
            </Button>

            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${modifyPreview.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRatePct}%)</span><span>${modifyPreview.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Total</span><span>${modifyPreview.total.toFixed(2)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModifyTarget(null); setModifyItems([]); }}>Cancel</Button>
            <Button onClick={handleModifySave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Syncing bookings...</p>
        </div>
      ) : !bookings?.length ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl border-border">
          <p className="text-muted-foreground">No bookings yet.</p>
        </div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              {statusFilter === "pending"
                ? `Pending Only (${activeBookings.length})`
                : `Active (${activeBookings.length})`}
            </TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center italic">No active bookings found.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {usePagedSlice(activeBookings, activePage).map(renderBookingCard)}
                </div>
                <Paginator page={activePage} pageSize={PAGE_SIZE} total={activeBookings.length} onChange={setActivePage} />
              </>
            )}
          </TabsContent>

          <TabsContent value="archived">
            {archivedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center italic">No archived bookings found.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {usePagedSlice(archivedBookings, archivePage).map(renderBookingCard)}
                </div>
                <Paginator page={archivePage} pageSize={PAGE_SIZE} total={archivedBookings.length} onChange={setArchivePage} />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
    </TooltipProvider>
  );
};

export default BookingsAdmin;
