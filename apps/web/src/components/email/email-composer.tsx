'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Send, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { sendContactEmail, uploadAttachment, type AttachmentRef } from '@/lib/actions/gmail';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';
import { RichEditor } from './rich-editor';

type ReplyContext = {
  threadId: string;
  inReplyTo: string | null;
  references: string | null;
  suggestedSubject: string;
};

export function EmailComposer({
  contactId,
  to,
  replyTo,
  onSent,
}: {
  contactId: string;
  to: string;
  replyTo?: ReplyContext;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(replyTo?.suggestedSubject ?? '');
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [isSending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 25 MB`);
          continue;
        }
        const b64 = await fileToBase64(file);
        const res = await uploadAttachment({
          filename: file.name,
          content_type: file.type || null,
          size: file.size,
          data_base64: b64,
        });
        if (res.error) {
          toast.error(`Upload failed for ${file.name}: ${res.error}`);
          continue;
        }
        if (res.attachment) {
          setAttachments((prev) => [...prev, res.attachment]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function onSubmit() {
    setError(null);
    if (!subject.trim()) {
      setError('Subject required');
      return;
    }
    if (!text.trim()) {
      setError('Message required');
      return;
    }
    startSending(async () => {
      const res = await sendContactEmail({
        contact_id: contactId,
        to,
        subject,
        text_body: text,
        html_body: html || null,
        thread_id: replyTo?.threadId ?? null,
        in_reply_to: replyTo?.inReplyTo ?? null,
        references: replyTo?.references ?? null,
        attachments,
      });
      if ('error' in res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Email sent');
      setSubject('');
      setHtml('');
      setText('');
      setAttachments([]);
      onSent?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        To: <span className="font-medium">{to}</span>
      </div>

      <Field label="Subject" htmlFor="email-subject">
        <input
          id="email-subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          className={inputCls}
        />
      </Field>

      <Field label="Message" htmlFor="email-body">
        <RichEditor
          value={html}
          onChange={(nextHtml, nextText) => {
            setHtml(nextHtml);
            setText(nextText);
          }}
          placeholder="Write your message…"
        />
      </Field>

      {attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{a.filename}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : 'Attach file'}
          </button>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSending || uploading}
          className={buttonPrimaryCls}
        >
          <Send className="h-4 w-4" />
          {isSending ? 'Sending…' : replyTo ? 'Send reply' : 'Send email'}
        </button>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:*/*;base64," prefix
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
