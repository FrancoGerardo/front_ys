"use client"

import type React from "react"

import { useRef, useState, useCallback } from "react"
import type { UMLClass, Association } from "@/types/uml"
import { ClassNode } from "./class-node"
import { AssociationLine } from "./association-line"
import { AssociationClassEditor } from "./association-class-editor"
import { ClassEditor } from "./class-editor"


interface DiagramCanvasProps {
  classes: UMLClass[]
  associations: Association[]
  selectedClass: string | null
  onUpdateClass: (id: string, updates: Partial<UMLClass>) => void
  onSelectClass: (id: string | null) => void
  onRemoveAssociation?: (id: string) => void
  onUpdateAssociation?: (association: Association) => void
  // Real-time collaboration props
  cursors?: Record<string, { user: any; x: number; y: number }>
  onCursorMove?: (x: number, y: number) => void
  onRemotePatch?: (patch: any) => void
}

export function DiagramCanvas({
  classes,
  associations,
  selectedClass,
  onUpdateClass,
  onSelectClass,
  onRemoveAssociation,
  onUpdateAssociation,
  cursors,
  onCursorMove,
  onRemotePatch,
}: DiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggedClass, setDraggedClass] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [editingAssociationId, setEditingAssociationId] = useState<string | null>(null)
  const [editingClassId, setEditingClassId] = useState<string | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, classId: string) => {
      e.preventDefault()
      const classElement = e.currentTarget as HTMLElement
      const rect = classElement.getBoundingClientRect()
      const canvasRect = canvasRef.current?.getBoundingClientRect()

      if (canvasRect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
        setDraggedClass(classId)
        onSelectClass(classId)
      }
    },
    [onSelectClass],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedClass && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        const newX = e.clientX - canvasRect.left - dragOffset.x
        const newY = e.clientY - canvasRect.top - dragOffset.y

        onUpdateClass(draggedClass, {
          position: { x: Math.max(0, newX), y: Math.max(0, newY) },
        })
      }
    },
    [draggedClass, dragOffset, onUpdateClass],
  )

  const handleMouseUp = useCallback(() => {
    // Capture current draggedClass value from closure
    const currentDragged = draggedClass
    setDraggedClass(null)
    setDragOffset({ x: 0, y: 0 })
    // When drag ends, notify remote patch for last dragged class
    if (currentDragged && onRemotePatch) {
      // Find latest position for the class
      const cls = classes.find(c => c.id === currentDragged)
      const pos = cls?.position || { x: 0, y: 0 }
      // Send a patch describing the new position
      onRemotePatch({ type: 'move_class', id: currentDragged, position: pos })
    }
  }, [draggedClass, onRemotePatch])

  const handleCanvasClick = useCallback(() => {
    onSelectClass(null)
  }, [onSelectClass])

  // Track mouse move relative to canvas and emit via onCursorMove
  const handleMouseMoveOverCanvas = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (onCursorMove) onCursorMove(x, y)
  }, [onCursorMove])

  const handleEditAssociationClass = useCallback((associationId: string) => {
    setEditingAssociationId(associationId)
  }, [])

  const handleUpdateAssociation = useCallback((association: Association) => {
    if (onUpdateAssociation) {
      onUpdateAssociation(association)
    }
    setEditingAssociationId(null)
  }, [onUpdateAssociation])

  const handleClassContextMenu = useCallback((e: React.MouseEvent, umlClass: UMLClass) => {
    setEditingClassId(umlClass.id)
  }, [])

  const handleUpdateEditingClass = useCallback((id: string, updates: Partial<UMLClass>) => {
    onUpdateClass(id, updates)
    setEditingClassId(null)
  }, [onUpdateClass])

  const editingAssociation = editingAssociationId 
    ? associations.find(a => a.id === editingAssociationId)
    : null

  const editingClass = editingClassId 
    ? classes.find(c => c.id === editingClassId)
    : null

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto cursor-default bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20px 20px, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
      onMouseMove={(e) => { handleMouseMove(e); handleMouseMoveOverCanvas(e); }}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* SVG container for association lines */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 1 }}>
        <g className="pointer-events-auto">
          {associations.map((association) => (
            <AssociationLine
              key={association.id}
              association={association}
              classes={classes}
              onRemoveAssociation={onRemoveAssociation}
              onEditAssociationClass={handleEditAssociationClass}
            />
          ))}
        </g>
      </svg>

      {/* Render classes */}
      {classes.map((umlClass) => (
        <ClassNode
          key={umlClass.id}
          umlClass={umlClass}
          isSelected={selectedClass === umlClass.id}
          onMouseDown={(e) => handleMouseDown(e, umlClass.id)}
          onContextMenu={handleClassContextMenu}
        />
      ))}

      {/* Remote cursors */}
      {cursors && Object.keys(cursors).map((userId) => {
        const cursor = cursors[userId]
        if (!cursor) return null
        const left = cursor.x
        const top = cursor.y
        const name = cursor.user?.username || cursor.user?.email || 'user'
        const initials = name.split(' ').map((p: string) => p[0]).slice(0,2).join('').toUpperCase()
        return (
          <div key={`cursor-${userId}`} style={{ position: 'absolute', left, top, zIndex: 50, pointerEvents: 'none' }}>
            <div className="flex items-center gap-2 bg-white/90 dark:bg-black/80 text-xs px-2 py-1 rounded shadow">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">{initials}</div>
              <div className="text-xs text-gray-700 dark:text-gray-200">{name}</div>
            </div>
          </div>
        )
      })}

      {/* Instructions overlay when no classes exist */}
      {classes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Welcome to UML Designer
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Create your first class to start designing your UML diagram
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs">+</kbd>
                <span>Add Class</span>
              </div>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs">Right Click</kbd>
                <span>Edit Class</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Association Class Editor */}
      {editingAssociation && editingAssociation.associationClass && (
        <AssociationClassEditor
          association={editingAssociation}
          onUpdateAssociation={handleUpdateAssociation}
          onClose={() => setEditingAssociationId(null)}
        />
      )}

      {/* Class Editor */}
      {editingClassId && (
        <ClassEditor
          classId={editingClassId}
          classes={classes}
          onUpdateClass={handleUpdateEditingClass}
          onClose={() => setEditingClassId(null)}
        />
      )}
    </div>
  )
}

