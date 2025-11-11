"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, Edit3, Code, FileDown } from "lucide-react"
import type { UMLClass, Association } from "@/types/uml"
import { ClassEditor } from "./class-editor"
import { AssociationEditor } from "./association-editor"
import { CodePreview } from "./code-preview"
import { generateSpringBootCode } from "@/lib/code-generator"

interface SidebarProps {
  classes: UMLClass[]
  associations: Association[]
  selectedClass: string | null
  onAddClass: (newClass: UMLClass) => void
  onUpdateClass: (id: string, updates: Partial<UMLClass>) => void
  onRemoveClass: (id: string) => void
  onAddAssociation: (association: Association) => void
  onRemoveAssociation: (id: string) => void
  onSelectClass: (id: string | null) => void
}

export function Sidebar({
  classes,
  associations,
  selectedClass,
  onAddClass,
  onUpdateClass,
  onRemoveClass,
  onAddAssociation,
  onRemoveAssociation,
  onSelectClass,
}: SidebarProps) {
  const [newClassName, setNewClassName] = useState("")
  const [editingClass, setEditingClass] = useState<string | null>(null)
  const [showAssociationEditor, setShowAssociationEditor] = useState(false)
  const [showCodePreview, setShowCodePreview] = useState(false)

  const handleAddClass = () => {
    if (newClassName.trim()) {
      const newClass: UMLClass = {
        id: crypto.randomUUID(),
        name: newClassName.trim(),
        attributes: [],
        position: { x: 100, y: 100 },
      }
      onAddClass(newClass)
      setNewClassName("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddClass()
    }
  }

  const handleExportCode = () => {
    setShowCodePreview(true)
  }

  const exportDiagramAsJSON = () => {
    const diagramData = {
      classes,
      associations,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(diagramData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "uml-diagram.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-semibold text-sidebar-foreground">UML Class Editor</h1>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Add New Class Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add Class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="className">Class Name</Label>
                <Input
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter class name"
                />
              </div>
              <Button onClick={handleAddClass} className="w-full" disabled={!newClassName.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </CardContent>
          </Card>

          {/* Classes List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Classes ({classes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No classes created yet</p>
              ) : (
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClass === cls.id
                          ? "bg-primary/10 border-primary"
                          : "bg-card hover:bg-accent/50 border-border"
                      }`}
                      onClick={() => onSelectClass(cls.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{cls.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {cls.attributes.length} attribute{cls.attributes.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingClass(cls.id)
                            }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveClass(cls.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Associations Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Associations ({associations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowAssociationEditor(true)}
                className="w-full mb-3"
                disabled={classes.length < 2}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Association
              </Button>
              {associations.length === 0 ? (
                <p className="text-muted-foreground text-sm">No associations created yet</p>
              ) : (
                <div className="space-y-2">
                  {associations.map((assoc) => {
                    const fromClass = classes.find((c) => c.id === assoc.fromClassId)
                    const toClass = classes.find((c) => c.id === assoc.toClassId)
                    return (
                      <div key={assoc.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {fromClass?.name} → {toClass?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assoc.fromMultiplicity} to {assoc.toMultiplicity}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => onRemoveAssociation(assoc.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleExportCode} className="w-full" disabled={classes.length === 0}>
                <Code className="w-4 h-4 mr-2" />
                Generate Spring Boot Code
              </Button>
              <Button
                onClick={exportDiagramAsJSON}
                variant="outline"
                className="w-full bg-transparent"
                disabled={classes.length === 0}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export Diagram (JSON)
              </Button>
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground">Create classes to enable export options</p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Class Editor Modal */}
      {editingClass && (
        <ClassEditor
          classId={editingClass}
          classes={classes}
          onUpdateClass={onUpdateClass}
          onClose={() => setEditingClass(null)}
        />
      )}

      {/* Association Editor Modal */}
      {showAssociationEditor && (
        <AssociationEditor
          classes={classes}
          onAddAssociation={onAddAssociation}
          onClose={() => setShowAssociationEditor(false)}
        />
      )}

      {showCodePreview && (
        <CodePreview
          generatedCode={generateSpringBootCode(classes, associations)}
          classes={classes}
          associations={associations}
          onClose={() => setShowCodePreview(false)}
        />
      )}
    </div>
  )
}
