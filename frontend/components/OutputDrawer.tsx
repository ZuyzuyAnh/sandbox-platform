'use client'

import { useEffect, useRef, useState } from 'react'
import { useSandboxOutput } from '@/hooks/useSandboxOutput'
import { OutputLine } from '@/types'

interface OutputDrawerProps {
  sandboxId: string
  task: string
  agent: string
  onClose: () => void
}

const LINE_STYLES: Record<string, { prefix: string; className: string }> = {
  thought:  { prefix: '💭', className: 'italic text-gray-400' },
  tool_use: { prefix: '🔧', className: 'font-mono text-amber-400' },
  code:     { prefix: '>',  className: 'font-mono text-green-400 bg-gray-900 px-2 rounded' },
  output:   { prefix: '',   className: 'text-gray-300' },
  completed:{ prefix: '✓',  className: 'text-emerald-400 font-semibold' },
  error:    { prefix: '✕',  className: 'text-red-400' },
}

function OutputRow({ line }: { line: OutputLine }) {
  const style = LINE_STYLES[line.event_type] ?? LINE_STYLES.output
  return (
    <div className="flex gap-2 py-0.5 leading-relaxed">
      {style.prefix && (
        <span className="flex-shrink-0 w-5 text-center">{style.prefix}</span>
      )}
      <span className={`break-all ${style.className} ${!style.prefix ? 'ml-7' : ''}`}>
        {line.message}
      </span>
    </div>
  )
}

export default function OutputDrawer({ sandboxId, task, agent, onClose }: OutputDrawerProps) {
  const { lines, isLoading } = useSandboxOutput(sandboxId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines, autoScroll])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10
    setAutoScroll(atBottom)
  }

  return (
    <div className="flex-shrink-0 bg-gray-950 border-t border-gray-800 flex flex-col h-72">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
        <span className="text-xs font-semibold text-violet-400">{agent}</span>
        <span className="text-gray-600">—</span>
        <span className="text-xs text-gray-400 truncate flex-1">{task}</span>
        <span className="text-xs font-mono text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">
          {sandboxId.slice(0, 8)}
        </span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-sm ml-1 transition-colors"
          aria-label="Close output drawer"
        >
          ✕
        </button>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs"
      >
        {isLoading ? (
          <div className="text-gray-500 animate-pulse">Connecting to agent...</div>
        ) : lines.length === 0 ? (
          <div className="text-gray-600">Waiting for output...</div>
        ) : (
          lines.map(line => <OutputRow key={line.id} line={line} />)
        )}
      </div>

      {/* Resume scroll hint */}
      {!autoScroll && (
        <div className="px-4 py-1 border-t border-gray-800 text-center">
          <button
            onClick={() => {
              setAutoScroll(true)
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
            }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ↓ Resume auto-scroll
          </button>
        </div>
      )}
    </div>
  )
}
