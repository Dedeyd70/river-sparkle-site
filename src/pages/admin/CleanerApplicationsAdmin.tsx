import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, Phone, MapPin, FileText, Trash2, ChevronDown, ChevronUp, Send } from "lucide-react";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";
import { RESPONSE_PRESETS, DECISION_TO_STAGE, sendApplicantEmail, type DecisionKey } from "@/lib/applicantEmail";

// Market-standard hiring pipeline. Legacy values kept for older rows.
type Status =
  | "new"
  | "reviewing"
  | "shortlisted"
  | "interview"
  | "hired"
  | "rejected"
  | "reviewed"
  | "contacted"
  | "archived";

interface CleanerApplication {
  id: string;
  full_name: string;
  middle_name: string | null;
  email: string;
  phone: string;
  address: string | null;
  resume_url: string | null;
  availability: string;
  experience: string;
  service_type: string;
  has_license: boolean | null;
  authorized_to_work: boolean | null;
  reference_1: string | null;
  reference_2: string | null;
  personality_bio: string | null;
  message: string | null;
  status: Status;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationResponse {
  id: string;
  application_id: string;
  decision: string | null;
  subject: string | null;
  body: string | null;
  recipient_email: string | null;
  sent_at: string;
}

const yesNo = (v: boolean | null) => (v === true ? "Yes" : v === false ? "No" : "—");

const statusColors: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  reviewing: "bg-blue-100 text-blue-800",
  shortlisted: "bg-violet-100 text-violet-800",
  interview: "bg-cyan-100 text-cyan-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  // legacy
  reviewed: "bg-blue-100 text-blue-800",
  contacted: "bg-green-100 text-green-800",
  archived: "bg-muted text-muted-foreground",
};

const STAGE_OPTIONS: { value: Status; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || "";

const CleanerApplicationsAdmin = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [statusFilter]);

  const { data: applications, isLoading } = useQuery({
    queryKey: ["cleaner-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaner_applications" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CleanerApplication[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cleaner_applications" as any)
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id ?? null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaner-applications"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cleaner_applications" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaner-applications"] });
      toast({ title: "Application deleted" });
    },
    onError: () => toast({ title: "Could not delete", variant: "destructive" }),
  });

  const filtered = (applications ?? []).filter((a) => statusFilter === "all" || a.status === statusFilter);

  const countBy = (s: Status) => applications?.filter((a) => a.status === s).length ?? 0;
  const tabs: { key: Status | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "reviewing", label: "Reviewing" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interview", label: "Interview" },
    { key: "hired", label: "Hired" },
    { key: "rejected", label: "Rejected" },
  ];
  const countFor = (k: Status | "all") => (k === "all" ? applications?.length ?? 0 : countBy(k));

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">Cleaner Applications</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Review applications submitted through the Become a Cleaner page and respond to applicants by email.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({countFor(t.key)})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted-foreground">No applications found.</p>
      ) : (
        <>
          <div className="space-y-3">
            {usePagedSlice(filtered, page).map((a) => (
              <ApplicationCard
                key={a.id}
                app={a}
                isOpen={!!expanded[a.id]}
                onToggle={() => setExpanded((p) => ({ ...p, [a.id]: !p[a.id] }))}
                onStatusChange={(status) => updateStatus.mutate({ id: a.id, status })}
                onDelete={() => deleteApp.mutate(a.id)}
              />
            ))}
          </div>
          <Paginator page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        </>
      )}
    </div>
  );
};

interface CardProps {
  app: CleanerApplication;
  isOpen: boolean;
  onToggle: () => void;
  onStatusChange: (status: Status) => void;
  onDelete: () => void;
}

const ApplicationCard = ({ app: a, isOpen, onToggle, onStatusChange, onDelete }: CardProps) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [loadingResume, setLoadingResume] = useState(false);
  const [decision, setDecision] = useState<DecisionKey | "">("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);

  const firstName = useMemo(() => firstNameOf(a.full_name), [a.full_name]);

  const { data: responses } = useQuery({
    queryKey: ["cleaner-application-responses", a.id],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaner_application_responses" as any)
        .select("*")
        .eq("application_id", a.id)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationResponse[];
    },
  });

  const applyPreset = (key: DecisionKey) => {
    const preset = RESPONSE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setDecision(key);
    setSubject(preset.subject);
    setBodyText(preset.body(firstName));
  };

  const viewResume = async () => {
    if (!a.resume_url) return;
    setLoadingResume(true);
    try {
      const { data, error } = await supabase.storage
        .from("cleaner-resumes")
        .createSignedUrl(a.resume_url, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Could not open resume", variant: "destructive" });
    } finally {
      setLoadingResume(false);
    }
  };

  const sendResponse = async () => {
    if (!decision || !subject.trim() || !bodyText.trim()) {
      toast({ title: "Pick a decision and complete the message.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error: emailErr } = await sendApplicantEmail({
        to: a.email,
        subject: subject.trim(),
        message: bodyText.trim(),
      });
      if (emailErr) throw emailErr;

      const { data: userData } = await supabase.auth.getUser();

      await supabase.from("cleaner_application_responses" as any).insert([
        {
          application_id: a.id,
          decision,
          subject: subject.trim(),
          body: bodyText.trim(),
          recipient_email: a.email,
          sent_by: userData.user?.id ?? null,
        },
      ] as any);

      const newStage = DECISION_TO_STAGE[decision];
      await supabase
        .from("cleaner_applications" as any)
        .update({ status: newStage, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id ?? null } as any)
        .eq("id", a.id);

      qc.invalidateQueries({ queryKey: ["cleaner-applications"] });
      qc.invalidateQueries({ queryKey: ["cleaner-application-responses", a.id] });
      setDecision("");
      setSubject("");
      setBodyText("");
      toast({ title: "Response sent", description: `Email sent to ${a.email}.` });
    } catch (err) {
      console.error("[applicant-response] failed:", err);
      toast({ title: "Could not send response", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{a.full_name}</h3>
            <Badge variant="secondary" className="text-xs">{a.service_type}</Badge>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[a.status] ?? "bg-muted text-muted-foreground"}`}>
              {a.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-primary">
              <Mail className="w-3 h-3" /> {a.email}
            </a>
            <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
              <Phone className="w-3 h-3" /> {a.phone}
            </a>
            <span>{format(new Date(a.created_at), "MMM d, yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={STAGE_OPTIONS.some((s) => s.value === a.status) ? a.status : ""}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {!STAGE_OPTIONS.some((s) => s.value === a.status) && (
              <option value="" disabled>{a.status}</option>
            )}
            {STAGE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete application?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes {a.full_name}'s application. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-border space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {a.middle_name && (
              <div>
                <p className="text-xs text-muted-foreground">Middle Name</p>
                <p className="text-foreground">{a.middle_name}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-foreground inline-flex items-center gap-1">
                {a.address ? (<><MapPin className="w-3 h-3 text-muted-foreground" /> {a.address}</>) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Availability</p>
              <p className="text-foreground">{a.availability}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Experience</p>
              <p className="text-foreground">{a.experience}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Driver's License</p>
              <p className="text-foreground">{yesNo(a.has_license)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Authorized to Work (US)</p>
              <p className="text-foreground">{yesNo(a.authorized_to_work)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">References</p>
              <ol className="list-decimal list-inside space-y-1 text-foreground">
                <li>{a.reference_1 || <span className="text-muted-foreground">—</span>}</li>
                <li>{a.reference_2 || <span className="text-muted-foreground">—</span>}</li>
              </ol>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Resume</p>
              {a.resume_url ? (
                <Button variant="outline" size="sm" onClick={viewResume} disabled={loadingResume}>
                  <FileText className="w-4 h-4 mr-1.5" />
                  {loadingResume ? "Opening…" : "View Resume"}
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">No resume attached</p>
              )}
            </div>
            {(a.personality_bio || a.message) && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Personality</p>
                <p className="text-foreground whitespace-pre-wrap">{a.personality_bio || a.message}</p>
              </div>
            )}
          </div>

          {/* Respond & email */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Respond to applicant</p>
            <div className="flex flex-wrap gap-2">
              {RESPONSE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    decision === p.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {decision && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor={`subject-${a.id}`} className="text-xs">Subject</Label>
                  <Input id={`subject-${a.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor={`body-${a.id}`} className="text-xs">Message</Label>
                  <Textarea id={`body-${a.id}`} rows={8} value={bodyText} onChange={(e) => setBodyText(e.target.value)} className="mt-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={sendResponse} disabled={sending}>
                    <Send className="w-4 h-4 mr-1.5" />
                    {sending ? "Sending…" : `Send & set to ${DECISION_TO_STAGE[decision]}`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDecision(""); setSubject(""); setBodyText(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Response history */}
          {responses && responses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Response history</p>
              {responses.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-foreground capitalize">{r.decision?.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(r.sent_at), "MMM d, yyyy · h:mm a")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CleanerApplicationsAdmin;
