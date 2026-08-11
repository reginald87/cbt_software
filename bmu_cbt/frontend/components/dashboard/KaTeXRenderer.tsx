'use client'

import React, { useEffect, useRef } from 'react'

interface KaTeXRendererProps {
  math: string
  display?: 'inline' | 'block'
  className?: string
}

declare global {
  interface Window {
    katex: any
    renderMathInElement: any
  }
}

export default function KaTeXRenderer({ math, display = 'inline', className = '' }: KaTeXRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Load KaTeX if not already loaded
    const loadKaTeX = () => {
      if (window.katex) {
        renderMath()
        return
      }

      const script = document.createElement('script')
      // Self-hosted copy (node_modules/katex -> public/katex) because the exam
      // network has no internet access to a CDN.
      script.src = '/katex/katex.min.js'
      script.onload = () => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = '/katex/katex.min.css'
        document.head.appendChild(link)
        
        setTimeout(renderMath, 100)
      }
      document.head.appendChild(script)
    }

    const renderMath = () => {
      if (!containerRef.current || !window.katex) return

      try {
        window.katex.render(math, containerRef.current, {
          displayMode: display === 'block',
          throwOnError: false,
          errorColor: '#cc0000',
          macros: {
            "\\f": "#1f(#1)",
            "\\N": "\\mathbb{N}",
            "\\R": "\\mathbb{R}",
            "\\Z": "\\mathbb{Z}"
          }
        })
      } catch (error) {
        console.error('KaTeX rendering error:', error)
        if (containerRef.current) {
          containerRef.current.textContent = math
          containerRef.current.className += ' text-red-500'
        }
      }
    }

    loadKaTeX()
  }, [math, display])

  return (
    <span 
      ref={containerRef}
      className={`katex-renderer ${display === 'block' ? 'block' : 'inline'} ${className}`}
      style={{ 
        display: display === 'block' ? 'block' : 'inline-block',
        margin: display === 'block' ? '1rem 0' : '0 0.2em'
      }}
    />
  )
}

// Chemical Formula Renderer
interface ChemFormulaProps {
  formula: string
  className?: string
}

export function ChemFormulaRenderer({ formula, className = '' }: ChemFormulaProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Simple chemical formula rendering
    // For production, you'd use a proper chemistry library like ChemDoodle
    const renderChemFormula = (formula: string) => {
      // Replace common chemical notation
      let rendered = formula
        .replace(/([A-Z][a-z]?)/g, '<span class="chem-element">$1</span>')
        .replace(/(\d+)/g, '<sub class="chem-subscript">$1</sub>')
        .replace(/\^(\d+)/g, '<sup class="chem-superscript">$1</sup>')
        .replace(/→/g, '<span class="chem-arrow">→</span>')
        .replace(/⇌/g, '<span class="chem-equilibrium">⇌</span>')
        .replace(/↑/g, '<span class="chem-up">↑</span>')
        .replace(/↓/g, '<span class="chem-down">↓</span>')

      return rendered
    }

    containerRef.current.innerHTML = renderChemFormula(formula)
  }, [formula])

  return (
    <span 
      ref={containerRef}
      className={`chem-formula ${className}`}
      style={{ fontFamily: 'Times New Roman, serif' }}
    />
  )
}
