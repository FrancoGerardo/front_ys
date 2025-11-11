"use client"

import type React from "react"

import type { UMLClass } from "@/types/uml"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ClassNodeProps {
  umlClass: UMLClass
  isSelected: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent, umlClass: UMLClass) => void
}

export function ClassNode({ umlClass, isSelected, onMouseDown, onContextMenu }: ClassNodeProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(e, umlClass)
  }

  return (
    <Card
      className={cn(
        "absolute min-w-48 uml-class cursor-move select-none shadow-lg hover:shadow-xl transition-all duration-200",
        "bg-gradient-to-b from-white to-gray-50 border-2 rounded-xl",
        isSelected && "ring-2 bg-[#f1e6d6] ring-opacity-50 shadow-2xl transform scale-105"
      )}
      style={{
        left: umlClass.position?.x || 0,
        top: umlClass.position?.y || 0,
      }}
      onMouseDown={onMouseDown}
      onContextMenu={handleContextMenu}
    >
      {/* Class name header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#f1e6d6] to-[#ece2d3] text-white font-bold text-center border-b-2 border-gray-200 rounded-t-lg">
        <div className="text-lg">{umlClass.name}</div>
      </div>

      {/* Attributes section */}
      <div className="px-4 py-3 bg-white rounded-b-lg">
        {umlClass.attributes.length === 0 ? (
          <div className="text-gray-400 text-sm italic text-center py-2">No attributes</div>
        ) : (
          <div className="space-y-2">
            {umlClass.attributes.map((attr) => (
              <div key={attr.id} className="text-sm font-mono text-gray-700 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                <span className="font-medium text-blue-700">{attr.name}</span>
                <span className="mx-2 text-gray-400">:</span>
                <span className="text-purple-600">{attr.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
