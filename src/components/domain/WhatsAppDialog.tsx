import { useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/misc'
import { useToast } from '@/components/ui/Toast'
import { whatsappUrl } from '@/domain/whatsapp'

export interface WhatsAppOption {
  key: string
  label: string
  text: string
}

/**
 * Preview a ready-written WhatsApp message, edit it if needed, then open WhatsApp with it.
 * Nothing is sent from here: the chat opens with the text filled in and the person presses send.
 * Rendered only while open.
 */
export function WhatsAppDialog({ name, phone, options, initial, onClose }: { name: string; phone: string; options: WhatsAppOption[]; initial?: string; onClose: () => void }) {
  const toast = useToast()
  const [key, setKey] = useState(options.some((o) => o.key === initial) ? initial! : options[0].key)
  // Edits are kept per message, so switching between them does not lose what was typed.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const option = options.find((o) => o.key === key) ?? options[0]
  const text = drafts[option.key] ?? option.text

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Message copied')
    } catch {
      toast.error('Could not copy', 'Select the message and copy it by hand.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send on WhatsApp"
      description={`Opens a WhatsApp chat with ${name.replace(/^Sample\s+/i, '')} (${phone}) with this message filled in. You press send there.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Not now</Button>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" aria-hidden />} onClick={copy}>Copy</Button>
          <a data-autofocus className={buttonClasses('primary', 'md')} href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <MessageCircle className="h-4 w-4" aria-hidden />
            Open WhatsApp
          </a>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {options.length > 1 ? <Tabs value={option.key} onChange={setKey} items={options.map((o) => ({ value: o.key, label: o.label }))} /> : null}
        <Field label="Message" hint="You can change the text before sending.">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={Math.min(18, text.split('\n').length + 1)} className="text-sm leading-relaxed" value={text} onChange={(e) => setDrafts((d) => ({ ...d, [option.key]: e.target.value }))} />}
        </Field>
      </div>
    </Modal>
  )
}
