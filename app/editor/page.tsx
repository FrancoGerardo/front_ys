"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { Toolbar } from "@/components/toolbar"
import { AIAssistantPanel } from "@/components/ai-assistant-panel"
import { AIFabButton } from "@/components/ai-fab-button"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { apiClient, tokenManager, type Diagram } from "@/lib/api-client"
import { io } from 'socket.io-client'
import { ArrowLeft, Save, LogOut, User, Loader2, Share2, Users } from "lucide-react"
import type { UMLClass, Association } from "@/types/uml"

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Loading diagram...</span>
      </div>
    </div>
  )
}

// Componente completamente dinámico - solo cliente
const DynamicEditorContent = dynamic(() => Promise.resolve(EditorContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Loading Editor...</span>
      </div>
    </div>
  )
})

function EditorContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  
  // Independent diagram state - don't depend on context
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null)
  const [classes, setClasses] = useState<UMLClass[]>([])
  const [associations, setAssociations] = useState<Association[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinToken, setJoinToken] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSharedDiagram, setIsSharedDiagram] = useState(false)
  const [sharedUsers, setSharedUsers] = useState<string[]>([])
  const socketRef = useRef<any | null>(null)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { user: any; x: number; y: number }>>({})

  // Load diagram data independently
  useEffect(() => {
    const loadDiagram = async () => {
      try {
        // Limpiar tokens expirados al inicio
        const globalTokens = localStorage.getItem('global-shared-tokens')
        if (globalTokens) {
          try {
            const tokensObj = JSON.parse(globalTokens) as Record<string, any>
            const now = new Date()
            const cleanedTokens: Record<string, any> = {}
            
            Object.keys(tokensObj).forEach(token => {
              const tokenData = tokensObj[token]
              const sharedAt = new Date(tokenData.sharedAt)
              const hoursDiff = (now.getTime() - sharedAt.getTime()) / (1000 * 60 * 60)
              
              // Mantener tokens que no tengan más de 24 horas
              if (hoursDiff < 24) {
                cleanedTokens[token] = tokenData
              }
            })
            
            localStorage.setItem('global-shared-tokens', JSON.stringify(cleanedTokens))
            console.log('Tokens expirados limpiados')
          } catch (error) {
            console.error('Error cleaning expired tokens:', error)
          }
        }
        
        // Get diagram ID from localStorage
        const diagramId = localStorage.getItem('currentDiagramId')
        
        if (!diagramId) {
          console.log('No diagram ID found in localStorage')
          router.push('/dashboard')
          return
        }

        console.log('Loading diagram with ID:', diagramId)
        
        // Get token
        const token = tokenManager.get()
        if (!token) {
          console.log('No token found')
          router.push('/login')
          return
        }

        // Load diagram directly from API
        const diagram = await apiClient.getDiagram(diagramId, token)
        console.log('Loaded diagram:', diagram)
        
        setCurrentDiagram(diagram)
        
        // Load diagram data
        const diagramData = diagram.diagram_data
        if (diagramData) {
          setClasses(diagramData.classes || [])
          setAssociations(diagramData.associations || [])
        } else {
          // Try to load from localStorage as backup
          const savedData = localStorage.getItem(`diagram_data_${diagram.id}`)
          if (savedData) {
            try {
              const parsedData = JSON.parse(savedData)
              setClasses(parsedData.classes || [])
              setAssociations(parsedData.associations || [])
              console.log('Loaded diagram data from localStorage backup')
            } catch (error) {
              console.error('Error parsing saved diagram data:', error)
            }
          }
        }
        
        setIsLoading(false)
        
      } catch (error) {
        console.error('Error loading diagram:', error)
        // Clear invalid diagram ID and redirect
        localStorage.removeItem('currentDiagramId')
        router.push('/dashboard')
      }
    }

    if (user) {
      loadDiagram()
    } else {
      router.push('/login')
    }
  }, [user, router])

  // Mark as having unsaved changes when data changes
  useEffect(() => {
    if (!isLoading) {
      setHasUnsavedChanges(true)
    }
  }, [classes, associations, isLoading])

  // Auto-save diagram data when classes or associations change
  useEffect(() => {
    if (!currentDiagram || classes.length === 0) return

    const autoSave = async () => {
      try {
        const diagramData = {
          classes: classes,
          associations: associations
        }
        
        console.log('Auto-saving diagram data:', diagramData)
        
        // Save to localStorage first
        localStorage.setItem(`diagram_data_${currentDiagram.id}`, JSON.stringify(diagramData))
        
        // If it's a shared diagram, also save to shared storage
        if (isSharedDiagram && currentDiagram.id.startsWith('shared-')) {
          const token = currentDiagram.id.replace('shared-', '')
          localStorage.setItem(`shared-token-${token}`, JSON.stringify({
            diagramId: currentDiagram.id,
            diagramData: diagramData,
            sharedAt: new Date().toISOString(),
            isActive: true,
            lastUpdated: new Date().toISOString()
          }))
        }
        
        // Then save to backend
        const token = tokenManager.get()
        if (token) {
          await apiClient.updateDiagram(currentDiagram.id, { diagram_data: diagramData }, token)
          console.log('Diagram auto-saved successfully')
        }
      } catch (error) {
        console.error('Error auto-saving diagram:', error)
      }
    }

    // Debounce auto-save
    const timeoutId = setTimeout(autoSave, 2000)
    return () => clearTimeout(timeoutId)
  }, [classes, associations, currentDiagram, isSharedDiagram])

  // Sistema de sincronización en tiempo real para diagramas compartidos
  useEffect(() => {
    if (!isSharedDiagram || !currentDiagram?.id.startsWith('shared-')) return

    const token = currentDiagram.id.replace('shared-', '')
    let lastUpdateTime = ''

    const checkForUpdates = () => {
      try {
        // Buscar en localStorage individual
        const sharedData = localStorage.getItem(`shared-token-${token}`)
        
        // También buscar en tokens globales
        const globalTokens = localStorage.getItem('global-shared-tokens')
        let foundData = null
        
        if (sharedData) {
          foundData = JSON.parse(sharedData)
        } else if (globalTokens) {
          const globalTokensObj = JSON.parse(globalTokens)
          if (globalTokensObj[token]) {
            foundData = globalTokensObj[token]
          }
        }
        
        if (foundData) {
          const { diagramData, lastUpdated } = foundData
          
          // Solo actualizar si hay cambios nuevos
          if (lastUpdated && lastUpdated !== lastUpdateTime) {
            lastUpdateTime = lastUpdated
            console.log('Detectados cambios en el diagrama compartido:', diagramData)
            
            // Actualizar el estado local
            setClasses(diagramData.classes || [])
            setAssociations(diagramData.associations || [])
            
            // Simular usuarios conectados
            setSharedUsers(['Usuario1', 'Usuario2'])
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }

    // Verificar cambios cada 3 segundos
    const interval = setInterval(checkForUpdates, 3000)
    
    return () => clearInterval(interval)
  }, [isSharedDiagram, currentDiagram])

  // Socket.IO: ONLY connect when sharing is explicitly enabled
  useEffect(() => {
    // Only connect WebSocket when explicitly sharing a diagram
    if (!isSharedDiagram || !currentDiagram) return

    // Support either JWT token or shared diagram token for socket auth
    const jwtToken = tokenManager.get()
    let authToken: string | null = null
    if (jwtToken) {
      authToken = jwtToken
    } else if (currentDiagram && typeof currentDiagram.id === 'string' && currentDiagram.id.startsWith('shared-')) {
      // use the shared token string (including prefix) so server can resolve it
      authToken = currentDiagram.id
    }
    if (!authToken) return

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    const socket = io(base, { auth: { token: authToken } })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected for sharing', socket.id)
      socket.emit('join_diagram', { diagram_id: currentDiagram.id })
    })

    socket.on('presence', (data: any) => {
      console.log('Presence:', data)
    })

    socket.on('user_joined', (data: any) => {
      console.log('User joined', data)
    })

    socket.on('user_left', (data: any) => {
      console.log('User left', data)
      // Remove cursor for that user
      if (data?.user?.id) {
        setRemoteCursors((prev) => {
          const copy = { ...prev }
          delete copy[data.user.id]
          return copy
        })
      }
    })

    socket.on('cursor_update', (data: any) => {
      // data: { user, x, y }
      if (!data?.user?.id) return
      setRemoteCursors((prev) => ({ ...prev, [data.user.id]: { user: data.user, x: data.x, y: data.y } }))
    })

    socket.on('remote_patch', (data: any) => {
      try {
        console.log('Remote patch', data)
        const patch = data?.patch
        if (!patch) return

        if (patch.type === 'move_class') {
          const { id, position } = patch
          setClasses((prev) => prev.map(c => c.id === id ? { ...c, position } : c))
        } else if (patch.type === 'create_class') {
          const newClass = patch.class
          // Avoid duplicates
          setClasses((prev) => {
            if (prev.find(c => c.id === newClass.id)) return prev
            return [...prev, newClass]
          })
        } else if (patch.type === 'delete_class') {
          const id = patch.id
          setClasses((prev) => prev.filter(c => c.id !== id))
          setAssociations((prev) => prev.filter((assoc) => assoc.fromClassId !== id && assoc.toClassId !== id))
        }
      } catch (e) {
        console.error('Error applying remote patch', e)
      }
    })

    socket.on('disconnect', (reason: any) => {
      console.log('Socket disconnected', reason)
    })

    return () => {
      try {
        if (socket && currentDiagram) {
          socket.emit('leave_diagram', { diagram_id: currentDiagram.id })
          socket.disconnect()
        }
      } catch (e) {
        console.error('Error disconnecting socket', e)
      }
      socketRef.current = null
      setRemoteCursors({})
    }
  }, [isSharedDiagram, currentDiagram])


  const handleCursorMove = (x: number, y: number) => {
    const socket = socketRef.current
    if (!socket || !currentDiagram) return
    socket.emit('cursor_move', { diagram_id: currentDiagram.id, x, y })
  }

  const handleRemotePatch = (patch: any) => {
    const socket = socketRef.current
    if (!socket || !currentDiagram) return
    console.log('Emitting patch', patch, 'to diagram', currentDiagram.id)
    socket.emit('broadcast_patch', { diagram_id: currentDiagram.id, patch })
  }

  const addClass = (newClass: UMLClass) => {
    setClasses((prev) => [...prev, newClass])
    // Broadcast creation to other clients
    try {
      handleRemotePatch({ type: 'create_class', class: newClass })
    } catch (e) {
      // ignore if socket not available
    }
  }

  const updateClass = (id: string, updatedClass: Partial<UMLClass>) => {
    setClasses((prev) => prev.map((cls) => (cls.id === id ? { ...cls, ...updatedClass } : cls)))
  }

  const removeClass = (id: string) => {
    setClasses((prev) => prev.filter((cls) => cls.id !== id))
    setAssociations((prev) => prev.filter((assoc) => assoc.fromClassId !== id && assoc.toClassId !== id))
    if (selectedClass === id) {
      setSelectedClass(null)
    }
    try {
      handleRemotePatch({ type: 'delete_class', id })
    } catch (e) {
      // ignore if socket not available
    }
  }

  const addAssociation = (association: Association) => {
    setAssociations((prev) => [...prev, association])
  }

  const updateAssociation = (updatedAssociation: Association) => {
    setAssociations((prev) => 
      prev.map((assoc) => assoc.id === updatedAssociation.id ? updatedAssociation : assoc)
    )
  }

  const removeAssociation = (id: string) => {
    setAssociations((prev) => prev.filter((assoc) => assoc.id !== id))
  }

  const handleGenerateClasses = (newClasses: UMLClass[]) => {
    setClasses((prev) => [...prev, ...newClasses])
  }

  const handleGenerateAssociations = (newAssociations: Association[]) => {
    setAssociations((prev) => [...prev, ...newAssociations])
  }

  // Funciones de compartir
  const handleShareDiagram = async () => {
    if (!currentDiagram) return
    
    try {
      // Generar token simple (8 caracteres)
      const token = Math.random().toString(36).substring(2, 10).toUpperCase()
      setShareToken(token)
      setShowShareModal(true)
      
      // Crear datos del diagrama actual
      const currentDiagramData = {
        classes: classes,
        associations: associations
      }
      
      console.log('Compartiendo diagrama con datos:', currentDiagramData)
      
      // Guardar el token en localStorage para referencia
      localStorage.setItem(`shared-token-${token}`, JSON.stringify({
        diagramId: currentDiagram.id,
        diagramData: currentDiagramData,
        sharedAt: new Date().toISOString(),
        isActive: true // Marcar como activo
      }))
      
      // También guardar en el backend si es posible
      try {
        const token_backend = tokenManager.get()
        if (token_backend) {
          await apiClient.updateDiagram(currentDiagram.id, { 
            diagram_data: currentDiagramData
          }, token_backend)
          console.log('Diagrama actualizado en backend con token de compartir')
        }
      } catch (backendError) {
        console.log('No se pudo actualizar en backend, usando solo localStorage')
      }
      
      // Guardar también en una clave global para que otros usuarios puedan encontrarlo
      localStorage.setItem('global-shared-tokens', JSON.stringify({
        ...JSON.parse(localStorage.getItem('global-shared-tokens') || '{}'),
        [token]: {
          diagramId: currentDiagram.id,
          diagramData: currentDiagramData,
          sharedAt: new Date().toISOString(),
          isActive: true
        }
      }))
      
      console.log('Token guardado:', token)
    } catch (error) {
      console.error('Error sharing diagram:', error)
    }
  }

  const handleJoinDiagram = async () => {
    if (!joinToken.trim()) return
    
    try {
      console.log('Intentando unirse con token:', joinToken)
      
      // Primero intentar buscar en localStorage individual
      const sharedData = localStorage.getItem(`shared-token-${joinToken}`)
      console.log('Datos encontrados en localStorage individual:', sharedData)
      
      // También buscar en la clave global
      const globalTokens = localStorage.getItem('global-shared-tokens')
      console.log('Tokens globales encontrados:', globalTokens)
      
      let foundData = null
      
      if (sharedData) {
        foundData = JSON.parse(sharedData)
      } else if (globalTokens) {
        const globalTokensObj = JSON.parse(globalTokens)
        if (globalTokensObj[joinToken]) {
          foundData = globalTokensObj[joinToken]
        }
      }
      
      if (foundData) {
        const { diagramId, diagramData, isActive } = foundData
        
        // Verificar si el token está activo
        if (!isActive) {
          alert(`Token ${joinToken} ha expirado o no está activo.`)
          setShowJoinModal(false)
          setJoinToken("")
          return
        }
        
        console.log('Diagrama encontrado:', diagramData)
        
        // Crear diagrama compartido con datos reales
        const sharedDiagram: Diagram = {
          id: `shared-${joinToken}`,
          project_id: `shared-project-${joinToken}`,
          diagram_data: diagramData,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        console.log('Diagrama compartido creado:', sharedDiagram)
        
        // Cargar el diagrama compartido
        setCurrentDiagram(sharedDiagram)
        setIsSharedDiagram(true) // Marcar como diagrama compartido
        
        // Cargar datos del diagrama
        if (sharedDiagram.diagram_data) {
          const classes = sharedDiagram.diagram_data.classes || []
          const associations = sharedDiagram.diagram_data.associations || []
          
          console.log('Cargando clases:', classes)
          console.log('Cargando asociaciones:', associations)
          
          setClasses(classes)
          setAssociations(associations)
          
          // Guardar en localStorage para persistencia
          localStorage.setItem('currentDiagramId', sharedDiagram.id)
          localStorage.setItem(`diagram_data_${sharedDiagram.id}`, JSON.stringify(diagramData))
          
          // Forzar re-render
          setTimeout(() => {
            console.log('Estado actual - clases:', classes.length)
            console.log('Estado actual - asociaciones:', associations.length)
          }, 100)
        }
        
        alert(`¡Te has unido al diagrama con token: ${joinToken}!`)
        setShowJoinModal(false)
        setJoinToken("")
      } else {
        // Si no encuentra en ningún lado, mostrar error
        alert(`Token ${joinToken} no encontrado. Asegúrate de que el token sea correcto y que el diagrama esté compartido.`)
        setShowJoinModal(false)
        setJoinToken("")
      }
    } catch (error) {
      console.error('Error joining diagram:', error)
      alert('Error al unirse al diagrama')
    }
  }

  const copyTokenToClipboard = () => {
    if (shareToken) {
      navigator.clipboard.writeText(shareToken)
      alert('Token copiado al portapapeles!')
    }
  }

  const handleSave = async () => {
    if (!currentDiagram) return

    setIsSaving(true)
    try {
      const token = tokenManager.get()
      if (!token) {
        router.push('/login')
        return
      }

      const diagramData = {
        classes,
        associations
      }
      
      // Save directly using API client
      const updatedDiagram = await apiClient.updateDiagram(
        currentDiagram.id, 
        { diagram_data: diagramData }, 
        token
      )
      
      console.log('Diagram saved successfully:', updatedDiagram)
      setCurrentDiagram(updatedDiagram)
      setHasUnsavedChanges(false)
      
    } catch (error) {
      console.error('Error saving diagram:', error)
      // Show error to user (you might want to add a toast notification here)
      alert('Error saving diagram. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        localStorage.removeItem('currentDiagramId')
        router.push('/dashboard')
      }
    } else {
      localStorage.removeItem('currentDiagramId')
      router.push('/dashboard')
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            UML Editor {currentDiagram && `- v${currentDiagram.version}`}
          </h1>
          {hasUnsavedChanges && (
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
          {isSharedDiagram && (
            <div className="flex items-center gap-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              <Users className="w-3 h-3" />
              <span>Compartido ({sharedUsers.length} usuarios)</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Unirse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareDiagram}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
          
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

      <Toolbar
        classes={classes}
        associations={associations}
        selectedClass={selectedClass}
        onAddClass={addClass}
        onUpdateClass={updateClass}
        onRemoveClass={removeClass}
        onAddAssociation={addAssociation}
        onRemoveAssociation={removeAssociation}
        onSelectClass={setSelectedClass}
      />
      
      <main className="flex-1 overflow-hidden">
        {classes.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-6xl mb-4">📊</div>
              <p className="text-gray-600 dark:text-gray-300 font-medium text-lg mb-2">No hay clases en el diagrama</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {currentDiagram?.id?.startsWith('shared-') 
                  ? 'Diagrama compartido vacío' 
                  : 'Crea tu primera clase o únete a un diagrama compartido'
                }
              </p>
              {!currentDiagram?.id?.startsWith('shared-') && (
                <div className="mt-4 space-y-2">
                  <Button 
                    onClick={() => addClass({ 
                      id: `class-${Date.now()}`,
                      name: 'Nueva Clase', 
                      attributes: [], 
                      position: { x: 100, y: 100 }
                    })}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Crear Primera Clase
                  </Button>
                  <div className="text-xs text-gray-500">
                    O prueba el sistema de compartir:
                  </div>
                  <Button 
                    onClick={() => {
                      // Crear algunas clases de ejemplo con posición
                      addClass({ 
                        id: `class-usuario-${Date.now()}`,
                        name: 'Usuario', 
                        attributes: [
                          { id: `attr-id-${Date.now()}`, name: 'id', type: 'String' },
                          { id: `attr-nombre-${Date.now()}`, name: 'nombre', type: 'String' }
                        ], 
                        position: { x: 100, y: 100 }
                      })
                      addClass({ 
                        id: `class-producto-${Date.now()}`,
                        name: 'Producto', 
                        attributes: [
                          { id: `attr-precio-${Date.now()}`, name: 'precio', type: 'Double' }
                        ], 
                        position: { x: 400, y: 100 }
                      })
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Crear Diagrama de Ejemplo
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DiagramCanvas
            classes={classes}
            associations={associations}
            selectedClass={selectedClass}
            onUpdateClass={updateClass}
            onSelectClass={setSelectedClass}
            onRemoveAssociation={removeAssociation}
            onUpdateAssociation={updateAssociation}
            cursors={remoteCursors}
            onCursorMove={handleCursorMove}
            onRemotePatch={handleRemotePatch}
          />
        )}
      </main>
      
      {/* AI Assistant Components */}
      <AIFabButton onClick={() => setIsAIAssistantOpen(true)} />
      
      {/* Modal Compartir */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Compartir Diagrama</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Token de acceso:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareToken || ""}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                />
                <Button onClick={copyTokenToClipboard} size="sm">
                  Copiar
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Comparte este token con otros usuarios para que puedan editar el diagrama.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowShareModal(false)} className="flex-1">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unirse */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Unirse a Diagrama</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Token de acceso:</label>
              <input
                type="text"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value.toUpperCase())}
                placeholder="Ingresa el token"
                className="w-full px-3 py-2 border rounded-md"
                maxLength={8}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowJoinModal(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleJoinDiagram} className="flex-1" disabled={!joinToken.trim()}>
                Unirse
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <AIAssistantPanel
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onGenerateClasses={handleGenerateClasses}
        onGenerateAssociations={handleGenerateAssociations}
        existingClasses={classes}
        existingAssociations={associations}
      />
    </div>
  )
}

// Componente principal que exporta el editor dinámico
export default function EditorPage() {
  return <DynamicEditorContent />
}