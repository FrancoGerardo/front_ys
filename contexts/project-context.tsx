"use client"

import { createContext, useContext, useState, useEffect } from 'react'
import { apiClient, tokenManager, type Project, type Diagram, type CreateProjectRequest, type CreateDiagramRequest, type UpdateDiagramRequest } from '@/lib/api-client'
import { useAuth } from './auth-context'

interface ProjectContextType {
  // Projects
  projects: Project[]
  currentProject: Project | null
  isLoadingProjects: boolean
  createProject: (data: CreateProjectRequest) => Promise<Project>
  loadProjects: () => Promise<void>
  selectProject: (project: Project) => void
  deleteProject: (projectId: string) => Promise<void>
  
  // Diagrams
  diagrams: Diagram[]
  currentDiagram: Diagram | null
  isLoadingDiagrams: boolean
  createDiagram: (data: CreateDiagramRequest) => Promise<Diagram>
  loadProjectDiagrams: (projectId: string) => Promise<void>
  selectDiagram: (diagram: Diagram) => void
  saveDiagram: (diagramId: string, diagramData: any) => Promise<Diagram>
  deleteDiagram: (diagramId: string) => Promise<void>
  
  // UI State
  error: string | null
  clearError: () => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function useProjects() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider')
  }
  return context
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  
  // Diagrams state
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null)
  const [isLoadingDiagrams, setIsLoadingDiagrams] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Mounted state
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load projects when user is authenticated
  useEffect(() => {
    if (!mounted) return
    
    console.log('ProjectProvider useEffect triggered, user:', user?.username || user?.email || 'No user')
    if (user) {
      loadProjects()
      // Also try to restore current diagram from localStorage
      restoreCurrentDiagram()
    } else {
      // Clear state when user logs out
      setProjects([])
      setCurrentProject(null)
      setDiagrams([])
      setCurrentDiagram(null)
    }
  }, [user, mounted])

  const restoreCurrentDiagram = async () => {
    try {
      const diagramId = localStorage.getItem('currentDiagramId')
      console.log('restoreCurrentDiagram called with diagramId:', diagramId)
      
      if (!diagramId || diagramId === 'undefined' || diagramId === 'null') {
        console.log('No valid diagramId found, skipping restore')
        return
      }

      const token = tokenManager.get()
      if (!token) {
        console.log('No token found, skipping restore')
        return
      }

      console.log('Attempting to restore diagram:', diagramId)
      // Get the diagram from the API
      const diagram = await apiClient.getDiagram(diagramId, token)
      console.log('Got diagram from API:', diagram)
      
      if (diagram) {
        setCurrentDiagram(diagram)
        console.log('Set currentDiagram to:', diagram)
        
        // Also set the current project
        try {
          const project = await apiClient.getProject(diagram.project_id, token)
          console.log('Got project from API:', project)
          
          if (project) {
            setCurrentProject(project)
            // Load all diagrams for this project
            await loadProjectDiagrams(diagram.project_id)
          }
        } catch (projectError) {
          console.error('Error restoring project:', projectError)
        }
      }
    } catch (error) {
      console.error('Error restoring current diagram:', error)
      // Clear invalid diagram ID
      localStorage.removeItem('currentDiagramId')
    }
  }

  const loadProjects = async () => {
    const token = tokenManager.get()
    if (!token) return

    setIsLoadingProjects(true)
    setError(null)

    try {
      const projectList = await apiClient.getProjects(token)
      setProjects(projectList)
    } catch (error) {
      console.error('Error loading projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to load projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const createProject = async (data: CreateProjectRequest): Promise<Project> => {
    const token = tokenManager.get()
    console.log('Creating project with token:', token ? 'Token exists' : 'No token')
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const newProject = await apiClient.createProject(data, token)
      setProjects(prev => [...prev, newProject])
      return newProject
    } catch (error: any) {
      console.error('Error creating project:', error)
      
      // Handle specific error types
      if (error.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error.status === 422) {
        setError('Invalid project data. Please check your input.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const selectProject = (project: Project) => {
    setCurrentProject(project)
    loadProjectDiagrams(project.id)
  }

  const deleteProject = async (projectId: string): Promise<void> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      await apiClient.deleteProject(projectId, token)
      
      // Remove project from state
      setProjects(prev => prev.filter(p => p.id !== projectId))
      
      // If the deleted project was current, clear it
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setDiagrams([])
        setCurrentDiagram(null)
        localStorage.removeItem('currentDiagramId')
      }
    } catch (error: any) {
      console.error('Error deleting project:', error)
      
      if (error.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error.status === 404) {
        setError('Project not found or access denied.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete project'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const loadProjectDiagrams = async (projectId: string) => {
    const token = tokenManager.get()
    if (!token) return

    setIsLoadingDiagrams(true)
    setError(null)

    try {
      const diagramList = await apiClient.getProjectDiagrams(projectId, token)
      setDiagrams(diagramList)
    } catch (error) {
      console.error('Error loading diagrams:', error)
      setError(error instanceof Error ? error.message : 'Failed to load diagrams')
    } finally {
      setIsLoadingDiagrams(false)
    }
  }

  const createDiagram = async (data: CreateDiagramRequest): Promise<Diagram> => {
    const token = tokenManager.get()
    console.log('Creating diagram with token:', token ? 'Token exists' : 'No token')
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const newDiagram = await apiClient.createDiagram(data, token)
      setDiagrams(prev => [...prev, newDiagram])
      return newDiagram
    } catch (error) {
      console.error('Error creating diagram:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create diagram'
      setError(errorMessage)
      throw error
    }
  }

  const selectDiagram = (diagram: Diagram) => {
    setCurrentDiagram(diagram)
    // Save diagram ID to localStorage for persistence
    localStorage.setItem('currentDiagramId', diagram.id)
  }

  const saveDiagram = async (diagramId: string, diagramData: any): Promise<Diagram> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const updatedDiagram = await apiClient.updateDiagram(diagramId, { diagram_data: diagramData }, token)
      
      // Update the diagram in our state
      setDiagrams(prev => 
        prev.map(d => d.id === diagramId ? updatedDiagram : d)
      )
      
      // Update current diagram if it's the one we just saved
      if (currentDiagram?.id === diagramId) {
        setCurrentDiagram(updatedDiagram)
      }
      
      return updatedDiagram
    } catch (error) {
      console.error('Error saving diagram:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save diagram'
      setError(errorMessage)
      throw error
    }
  }

  const deleteDiagram = async (diagramId: string): Promise<void> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      await apiClient.deleteDiagram(diagramId, token)
      
      // Remove diagram from state
      setDiagrams(prev => prev.filter(d => d.id !== diagramId))
      
      // If the deleted diagram was current, clear it
      if (currentDiagram?.id === diagramId) {
        setCurrentDiagram(null)
        localStorage.removeItem('currentDiagramId')
      }
    } catch (error: any) {
      console.error('Error deleting diagram:', error)
      
      if (error.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error.status === 404) {
        setError('Diagram not found or access denied.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete diagram'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const clearError = () => setError(null)

  return (
    <ProjectContext.Provider value={{
      // Projects
      projects,
      currentProject,
      isLoadingProjects,
      createProject,
      loadProjects,
      selectProject,
      deleteProject,
      
      // Diagrams
      diagrams,
      currentDiagram,
      isLoadingDiagrams,
      createDiagram,
      loadProjectDiagrams,
      selectDiagram,
      saveDiagram,
      deleteDiagram,
      
      // UI State
      error,
      clearError
    }}>
      <div suppressHydrationWarning={true}>
        {children}
      </div>
    </ProjectContext.Provider>
  )
}