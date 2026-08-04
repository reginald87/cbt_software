'use client'

import React, { useEffect, useState } from 'react'

interface MathJaxRendererProps {
  content: string
  display?: boolean
  className?: string
}

declare global {
  interface Window {
    MathJax: any
  }
}

export default function MathJaxRenderer({ content, display = false, className = '' }: MathJaxRendererProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [processedContent, setProcessedContent] = useState('')

  useEffect(() => {
    // Load MathJax if not already loaded
    if (!window.MathJax) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
      script.async = true
      script.onload = () => {
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
                setIsLoaded(true)
              })
            }
          }
        }
      }
      document.head.appendChild(script)
    } else {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && window.MathJax && window.MathJax.typesetPromise) {
      // Process the content with MathJax
      const element = document.createElement('div')
      element.innerHTML = content
      element.style.display = 'none'
      document.body.appendChild(element)

      window.MathJax.typesetPromise([element]).then(() => {
        setProcessedContent(element.innerHTML)
        document.body.removeChild(element)
      }).catch((error: any) => {
        console.error('MathJax error:', error)
        // Fallback to plain text if MathJax fails
        setProcessedContent(content.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1'))
        document.body.removeChild(element)
      })
    } else if (!isLoaded) {
      // Show plain text while MathJax is loading
      setProcessedContent(content.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1'))
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
  return content
    // Handle display math: $$...$$ or \[...\]
    .replace(/\$\$([^$]+)\$\$/g, '<div class="math-display">$$$1$$</div>')
    .replace(/\\\[([^\\\]]+)\\\]/g, '<div class="math-display">\\[$1\\]</div>')
    // Handle inline math: $...$ or \(...\)
    .replace(/\$([^$]+)\$/g, '<span class="math-inline">$1</span>')
    .replace(/\\\(([^\\\)]+)\\\)/g, '<span class="math-inline">\\($1\\)</span>')
    // Handle chemical equations
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
