"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProjects } from '@/contexts/project-context'
import { FolderPlus, Folder, FileText, Plus, Loader2, Trash2 } from 'lucide-react'
import type { Project, Diagram } from '@/lib/api-client'

interface ProjectManagerProps {
  onSelectDiagram?: (diagram: Diagram) => void
}

export function ProjectManager({ onSelectDiagram }: ProjectManagerProps) {
  const {
    projects,
    currentProject,
    isLoadingProjects,
    createProject,
    selectProject,
    deleteProject,
    diagrams,
    currentDiagram,
    isLoadingDiagrams,
    createDiagram,
    deleteDiagram,
    error,
    clearError
  } = useProjects()

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [isCreateDiagramOpen, setIsCreateDiagramOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null)
  const [isDeletingDiagram, setIsDeletingDiagram] = useState<string | null>(null)

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return

    setIsCreatingProject(true)
    try {
      console.log('About to create project with name:', projectName.trim())
      const projectData = { name: projectName.trim() }
      console.log('Project data object:', projectData)
      console.log('JSON.stringify result:', JSON.stringify(projectData))
      
      const newProject = await createProject(projectData)
      setProjectName('')
      setIsCreateProjectOpen(false)
      selectProject(newProject) // Auto-select the new project
    } catch (error) {
      console.error('Project creation failed in component:', error)
      // Error is handled by the context
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleCreateDiagram = async () => {
    if (!currentProject) return

    setIsCreatingDiagram(true)
    try {
      const newDiagram = await createDiagram({
        project_id: currentProject.id,
        diagram_data: { classes: [], associations: [] } // Empty diagram
      })
      setIsCreateDiagramOpen(false)
      
      if (onSelectDiagram) {
        onSelectDiagram(newDiagram)
      }
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsCreatingDiagram(false)
    }
  }

  const handleSelectDiagram = (diagram: Diagram) => {
    if (onSelectDiagram) {
      onSelectDiagram(diagram)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    setIsDeletingProject(projectId)
    try {
      await deleteProject(projectId)
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsDeletingProject(null)
    }
  }

  const handleDeleteDiagram = async (diagramId: string) => {
    setIsDeletingDiagram(diagramId)
    try {
      await deleteDiagram(diagramId)
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsDeletingDiagram(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <div>
              {error}
              {error.includes('session has expired') && (
                <div className="mt-2">
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Projects Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Projects
              </CardTitle>
              <CardDescription>
                Manage your UML projects
              </CardDescription>
            </div>
            <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Enter a name for your new UML project.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      placeholder="My UML Project"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                      disabled={isCreatingProject}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateProjectOpen(false)}
                      disabled={isCreatingProject}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingProject}>
                      {isCreatingProject ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No projects found. Create your first project to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 rounded-lg border transition-colors ${ 
                    currentProject?.id === project.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => selectProject(project)}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{project.name}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                          disabled={isDeletingProject === project.id}
                        >
                          {isDeletingProject === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{project.name}"? This action cannot be undone and will delete all diagrams in this project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProject(project.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Project
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagrams Section */}
      {currentProject && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Diagrams
                </CardTitle>
                <CardDescription>
                  Diagrams in {currentProject.name}
                </CardDescription>
              </div>
              <Dialog open={isCreateDiagramOpen} onOpenChange={setIsCreateDiagramOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New Diagram
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Diagram</DialogTitle>
                    <DialogDescription>
                      Create a new UML diagram in {currentProject.name}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDiagramOpen(false)}
                      disabled={isCreatingDiagram}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateDiagram} disabled={isCreatingDiagram}>
                      {isCreatingDiagram ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Diagram'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDiagrams ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading diagrams...</span>
              </div>
            ) : diagrams.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No diagrams found. Create your first diagram to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {diagrams.map((diagram) => (
                  <div
                    key={diagram.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      currentDiagram?.id === diagram.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => handleSelectDiagram(diagram)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              Diagram v{diagram.version}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(diagram.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Last modified {new Date(diagram.updated_at).toLocaleString()}
                        </p>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                            disabled={isDeletingDiagram === diagram.id}
                          >
                            {isDeletingDiagram === diagram.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Diagram</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "Diagram v{diagram.version}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDiagram(diagram.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Diagram
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}