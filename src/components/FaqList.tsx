'use client'

// Homepage FAQ accordion (design handoff "FAQ"): one answer open at a time.

import { useState } from 'react'

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="border-t border-[#cfe3dd]">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q} className="border-b border-[#cfe3dd]">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-4 py-5 text-start text-[17px] font-semibold text-[#182320]"
            >
              <span>{item.q}</span>
              <span
                aria-hidden
                className={`flex size-7 items-center justify-center rounded-full bg-[#0d6e60] text-base text-white transition-transform duration-200 ${
                  isOpen ? 'rotate-45' : ''
                }`}
              >
                +
              </span>
            </button>
            {isOpen && <p className="pe-12 pb-[22px] text-[15px] leading-relaxed text-[#65716c]">{item.a}</p>}
          </div>
        )
      })}
    </div>
  )
}
