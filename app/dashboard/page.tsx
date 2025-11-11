"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectManager } from '@/components/project-manager'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useProjects } from '@/contexts/project-context'
import { ArrowRight, LogOut, User } from 'lucide-react'
import type { Diagram } from '@/lib/api-client'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { currentProject, currentDiagram } = useProjects()
  const router = useRouter()
  const [selectedDiagram, setSelectedDiagram] = useState<Diagram | null>(null)

  const handleSelectDiagram = (diagram: Diagram) => {
    setSelectedDiagram(diagram)
  }

  const handleOpenEditor = () => {
    if (selectedDiagram) {
      // Store the selected diagram in localStorage or navigate with state
      localStorage.setItem('currentDiagramId', selectedDiagram.id)
      router.push('/editor')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">UML Editor Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <User className="w-4 h-4" />
            <span>{user?.username || user?.email}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Manager - Takes 2 columns */}
          <div className="lg:col-span-2">
            <ProjectManager onSelectDiagram={handleSelectDiagram} />
          </div>

          {/* Action Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              
              {currentProject ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Current Project
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {currentProject.name}
                    </p>
                  </div>

                  {selectedDiagram ? (
                    <>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Selected Diagram
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Version {selectedDiagram.version}
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleOpenEditor}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        Open in Editor
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select a diagram to open it in the editor
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-4">
                    Create or select a project to get started
                  </p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Statistics</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Projects</span>
                  <span className="font-medium">{useProjects().projects.length}</span>
                </div>
                {currentProject && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Diagrams</span>
                    <span className="font-medium">{useProjects().diagrams.length}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}