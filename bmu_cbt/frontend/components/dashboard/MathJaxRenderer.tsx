'use client'

import React, { useEffect, useRef, useState } from 'react'

interface MathJaxRendererProps {
  content: string
  display?: boolean
  className?: string
}

declare global {
  interface Window {
    MathJax: any
    __mathJaxLoading?: boolean
  }
}

// Self-hosted: the exam network has no internet access, so the MathJax runtime
// and its fonts are copied from node_modules into public/mathjax by
// scripts/copy-math-libs.js and served from the LAN server.
const MATHJAX_SRC = '/mathjax/tex-mml-chtml.js'

// Fallback used while MathJax is loading or typesetting fails: strip the math
// delimiters so the plain text is still readable. The old [^\\\]] class stopped
// at the first backslash, so \[ \frac{a}{b} \] was never stripped and leaked
// raw LaTeX into the fallback; [\s\S]+? handles backslashes inside the math.
function stripMathDelimiters(content: string): string {
  return content
    .replace(/\$\$([\s\S]+?)\$\$/g, '$1')
    .replace(/\\\[([\s\S]+?)\\\]/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\\\(([\s\S]+?)\\\)/g, '$1')
}

// Injects the MathJax script exactly once. The config object MUST be in place
// before the script is appended — MathJax reads window.MathJax while the script
// parses, so assigning it in script.onload is too late and `$`/`$$` delimiters
// (and the startup.ready hook) get silently ignored.
function loadMathJaxOnce() {
  if (window.__mathJaxLoading) return
  if (window.MathJax && window.MathJax.typesetPromise) return
  window.__mathJaxLoading = true

  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true
    },
    options: {
      ignoreHtmlClass: 'tex2jax_ignore',
      processHtmlClass: 'tex2jax_process'
    },
    startup: {
      ready: () => {
        window.MathJax.startup.defaultReady()
        window.MathJax.startup.promise.then(() => {
          window.__mathJaxLoading = false
          window.dispatchEvent(new Event('mathjax-ready'))
        })
      }
    }
  }

  const script = document.createElement('script')
  script.src = MATHJAX_SRC
  script.async = true
  script.onerror = () => {
    window.__mathJaxLoading = false
    // Allow instances to fall back to plain text instead of hanging forever.
    window.dispatchEvent(new Event('mathjax-ready'))
  }
  document.head.appendChild(script)
}

export default function MathJaxRenderer({ content, display = false, className = '' }: MathJaxRendererProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [processedContent, setProcessedContent] = useState('')
  const latestContentRef = useRef(content)
  latestContentRef.current = content

  useEffect(() => {
    const onReady = () => setIsLoaded(true)
    if (window.MathJax && window.MathJax.typesetPromise) {
      setIsLoaded(true)
      return
    }
    // Every instance listens so all of them flip to "loaded" when MathJax
    // finishes starting up, not just the one that injected the script.
    window.addEventListener('mathjax-ready', onReady)
    loadMathJaxOnce()
    return () => window.removeEventListener('mathjax-ready', onReady)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Immediately render the current content's plain text so a previous
    // question's typeset math never lingers while the new one is processed.
    setProcessedContent(stripMathDelimiters(content))

    if (!isLoaded || !window.MathJax || !window.MathJax.typesetPromise) return

    let cancelled = false
    const element = document.createElement('div')
    element.innerHTML = content
    // Do NOT use display:none while MathJax typesets: hidden elements report
    // zero dimensions, so measured constructs (fractions, \sqrt, \overset)
    // come out mis-sized on some browsers. Off-screen + visibility:hidden
    // keeps it out of the layout without breaking measurement.
    element.style.position = 'absolute'
    element.style.left = '-10000px'
    element.style.top = '0'
    element.style.visibility = 'hidden'
    document.body.appendChild(element)

    window.MathJax.typesetPromise([element])
      .then(() => {
        // Only apply the result if it still belongs to the latest content.
        if (!cancelled && latestContentRef.current === content) {
          setProcessedContent(element.innerHTML)
        }
      })
      .catch((error: any) => {
        console.error('MathJax error:', error)
        if (!cancelled) {
          setProcessedContent(stripMathDelimiters(content))
        }
      })
      .finally(() => {
        if (element.parentNode) element.parentNode.removeChild(element)
      })

    return () => {
      cancelled = true
    }
  }, [content, isLoaded])

  return (
    <div 
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}

// Helper function to process mixed content (text + LaTeX)
export function processMixedContent(content: string): string {
  // Match math spans in one pass so display math ($$...$$) is consumed before
  // the inline regex can match inside it. Delimiters are preserved so MathJax
  // can typeset them. [\s\S]+? (lazy) instead of [^$]+ / [^\\\]]+ so math
  // containing backslashes (e.g. \[ \frac{a}{b} \]) is matched correctly.
  return content
    .replace(
      /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\))/g,
      (match: string) => {
        if (match.startsWith('$$') && match.endsWith('$$')) {
          return `<div class="math-display">${match}</div>`
        }
        if (match.startsWith('\\[') && match.endsWith('\\]')) {
          return `<div class="math-display">${match}</div>`
        }
        if (match.startsWith('$') && match.endsWith('$')) {
          return `<span class="math-inline">${match}</span>`
        }
        if (match.startsWith('\\(') && match.endsWith('\\)')) {
          return `<span class="math-inline">${match}</span>`
        }
        return match
      }
    )
    // Handle chemical equation arrows
    .replace(/---/g, '→')
    .replace(/<->/g, '⇌')
    .replace(/=>/g, '⇒')
}

// Chemical Equation Renderer
interface ChemicalEquationProps {
  equation: string
  display?: boolean
  className?: string
}

export function ChemicalEquationRenderer({ equation, display = false, className = '' }: ChemicalEquationProps) {
  const processedEquation = equation
    .replace(/-->/g, '→')
    .replace(/<-->/g, '⇌')
    .replace(/=>/g, '⇒')
    // Handle subscripts (e.g., H2O -> H₂O)
    .replace(/(\d+)/g, '<sub>$1</sub>')
    // Handle superscripts (e.g., CO2^2- -> CO₂²⁻)
    .replace(/\^([+-]?\d+)/g, '<sup>$1</sup>')

  return (
    <div className={`chemical-equation ${display ? 'block' : 'inline'} ${className} font-mono`}>
      {processedEquation}
    </div  >
  )
}
