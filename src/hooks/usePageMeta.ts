import { useEffect } from 'react'

export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · GymBook` : 'GymBook'
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDesc = meta?.content
    if (description) {
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = description
    }
    return () => {
      document.title = prev
      if (meta && prevDesc !== undefined) meta.content = prevDesc
    }
  }, [title, description])
}
