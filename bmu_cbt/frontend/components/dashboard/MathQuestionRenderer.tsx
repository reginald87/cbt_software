'use client'

import React from 'react'
import MathJaxRenderer, { processMixedContent, ChemicalEquationRenderer } from './MathJaxRenderer'

interface MathQuestionRendererProps {
  questionText: string
  showMath?: boolean
  questionType?: string
}

export default function MathQuestionRenderer({ questionText, showMath = true, questionType = 'multiple' }: MathQuestionRendererProps) {
  if (!showMath) {
    return <div className="question-content">{questionText}</div>
  }

  // Handle different question types
  if (questionType === 'chemistry') {
    return <ChemicalEquationRenderer equation={questionText} display={false} />
  }

  // Process mixed content for math and other questions
  const processedContent = processMixedContent(questionText)

  return (
    <div className="math-question-content">
      <MathJaxRenderer content={processedContent} />
    </div>
  )
}

// Math Input Component for student answers
interface MathInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
}

export function MathInput({ value, onChange, onBlur, placeholder, disabled }: MathInputProps) {
  return (
    <div className="math-input-container">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter your answer (supports LaTeX: $x^2 + y^2 = z^2$)"}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        rows={3}
      />
      <div className="math-preview mt-2 p-3 bg-gray-50 rounded border border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Preview:</div>
        <div className="math-preview-content">
          {value ? <MathQuestionRenderer questionText={value} /> : <span className="text-gray-400">Answer preview will appear here</span>}
        </div>
      </div>
    </div>
  )
}

// Chemical Equation Input Component
interface ChemInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
}

export function ChemInput({ value, onChange, onBlur, placeholder, disabled }: ChemInputProps) {
  const insertSymbol = (symbol: string) => {
    if (!disabled) {
      onChange(value + symbol)
    }
  }

  return (
    <div className="chem-input-container">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter chemical equation (e.g., H2O + CO2 → H2CO3)"}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
        rows={2}
      />
      <div className="chem-tools mt-2 flex gap-2 flex-wrap">
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol(' → ')}
          disabled={disabled}
        >
          →
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol(' ⇌ ')}
          disabled={disabled}
        >
          ⇌
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('↑')}
          disabled={disabled}
        >
          ↑
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('↓')}
          disabled={disabled}
        >
          ↓
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('₂')}
          disabled={disabled}
        >
          ₂
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('³')}
          disabled={disabled}
        >
          ³
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('⁺')}
          disabled={disabled}
        >
          ⁺
        </button>
        <button 
          type="button"
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          onClick={() => insertSymbol('⁻')}
          disabled={disabled}
        >
          ⁻
        </button>
      </div>
      <div className="chem-preview mt-2 p-3 bg-gray-50 rounded border border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Preview:</div>
        <div className="chem-preview-content">
          {value ? <ChemicalEquationRenderer equation={value} /> : <span className="text-gray-400">Equation preview will appear here</span>}
        </div>
      </div>
    </div>
  )
}
