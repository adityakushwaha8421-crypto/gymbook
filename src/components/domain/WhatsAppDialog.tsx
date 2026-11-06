import { useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/misc'
import { useToast } from '@/components/ui/Toast'
import { MESSAGE_LANGS, whatsappUrl, type MessageLang } from '@/domain/whatsapp'

export interface WhatsAppOption {
  key: string
  label: string
  /** The same message in each language the desk can send it in. */
  text: Record<MessageLang, string>
}

const LANG_KEY = 'gymbook-whatsapp-lang'

/** The language used last time on this device, so a Marathi-speaking desk does not switch every time. */
function savedLang(): MessageLang {
  try {
    return localStorage.getItem(LANG_KEY) === 'mr' ? 'mr' : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Preview a ready-written WhatsApp message, edit it if needed, then open WhatsApp with it.
 * Nothing is sent from here: the chat opens with the text filled in and the person presses send.
 * Rendered only while open.
 */
export function WhatsAppDialog({ name, phone, options, initial, onClose }: { name: string; phone: string; options: WhatsAppOption[]; initial?: string; onClose: () => void }) {
  const toast = useToast()
  const [key, setKey] = useState(options.some((o) => o.key === initial) ? initial! : options[0].key)
  const [lang, setLangState] = useState<MessageLang>(savedLang)
  // Edits are kept per message and language, so switching between them does not lose what was typed.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const option = options.find((o) => o.key === key) ?? options[0]
  const draftKey = `${option.key}:${lang}`
  const text = drafts[draftKey] ?? option.text[lang]

  const setLang = (next: MessageLang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // private mode or blocked storage: the choice simply lasts for this dialog
    }
  }

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          {options.length > 1 ? <Tabs aria-label="Template" value={option.key} onChange={setKey} items={options.map((o) => ({ value: o.key, label: o.label }))} /> : <span />}
          <Tabs aria-label="Language" value={lang} onChange={setLang} items={MESSAGE_LANGS} />
        </div>
        <Field label="Message" hint="You can change the text before sending.">
          {({ id, describedBy }) => <Textarea id={id} lang={lang} aria-describedby={describedBy} rows={Math.min(18, text.split('\n').length + 1)} className="text-sm leading-relaxed" value={text} onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))} />}
        </Field>
      </div>
    </Modal>
  )
}
