const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export interface RegisterRequest {
  email: string
  username: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface AuthResponseNormalized {
  token: string
  user: {
    id: string
    email: string
    username: string
  }
}

export interface User {
  id: string
  email: string
  username: string
}

// Project interfaces
export interface CreateProjectRequest {
  name: string
}

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// Diagram interfaces
export interface CreateDiagramRequest {
  project_id: string
  diagram_data: any // jsonb type - will contain UML classes and associations
}

export interface UpdateDiagramRequest {
  diagram_data: any // jsonb type
}

export interface Diagram {
  id: string
  project_id: string
  diagram_data: any // jsonb type
  version: number
  created_at: string
  updated_at: string
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  console.log('Making API request to:', url)
  console.log('Request method:', options.method)
  console.log('Request headers:', options.headers)
  console.log('Request body type:', typeof options.body, options.body)
  
  // Don't set Content-Type for FormData, let browser handle it
  const isFormData = options.body instanceof FormData
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...options.headers as Record<string, string>,
  }
  
  // Only set default Content-Type if not already set and not FormData
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  console.log('Final headers:', headers)
  
  const response = await fetch(url, {
    headers,
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('API Error:', response.status, errorText)
    
    // Handle token expiration
    if (response.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
      }
    }
    
    throw new ApiError(response.status, errorText || 'API request failed')
  }

  return response.json()
}

export const apiClient = {
  // Register new user
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Login user
  login: async (data: LoginRequest): Promise<AuthResponseNormalized> => {
    try {
      console.log('Making login request to:', `${API_BASE_URL}/login`)
      const response = await apiRequest<AuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      
      console.log('Login response:', response)
      
      if (!response.access_token) {
        throw new Error('No access_token in login response')
      }
      
      // Get user info using the token
      console.log('Getting user info with token:', response.access_token.substring(0, 20) + '...')
      const user = await apiRequest<User>('/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${response.access_token}`,
        },
      })
      
      console.log('User info received:', user)
      
      return {
        token: response.access_token,
        user
      }
    } catch (error) {
      console.error('Login API error:', error)
      throw error
    }
  },

  // Get current user info
  me: async (token: string): Promise<User> => {
    return apiRequest<User>('/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  // Project management
  createProject: async (data: CreateProjectRequest, token: string): Promise<Project> => {
    console.log('Creating project with data:', data)
    console.log('Using token:', token.substring(0, 20) + '...')
    
    // Based on your curl example, the backend DOES accept JSON
    // The issue might be with charset or exact Content-Type
    
    const requestBody = JSON.stringify(data)
    console.log('JSON body being sent:', requestBody)
    
    // Try with exact same Content-Type as working curl
    return apiRequest<Project>('/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', // Remove charset
      },
      body: requestBody,
    })
  },

  getProjects: async (token: string): Promise<Project[]> => {
    return apiRequest<Project[]>('/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  getProject: async (projectId: string, token: string): Promise<Project> => {
    return apiRequest<Project>(`/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  deleteProject: async (projectId: string, token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  // Diagram management
  createDiagram: async (data: CreateDiagramRequest, token: string): Promise<Diagram> => {
    console.log('Creating diagram with data:', data)
    console.log('Using token:', token.substring(0, 20) + '...')
    
    const requestBody = JSON.stringify(data)
    console.log('JSON body being sent:', requestBody)
    
    return apiRequest<Diagram>('/diagrams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    })
  },

  getProjectDiagrams: async (projectId: string, token: string): Promise<Diagram[]> => {
    return apiRequest<Diagram[]>(`/projects/${projectId}/diagrams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  getDiagram: async (diagramId: string, token: string): Promise<Diagram> => {
    return apiRequest<Diagram>(`/diagrams/${diagramId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  updateDiagram: async (diagramId: string, data: UpdateDiagramRequest, token: string): Promise<Diagram> => {
    console.log('Updating diagram with data:', data)
    console.log('Using token:', token.substring(0, 20) + '...')
    
    const requestBody = JSON.stringify(data)
    console.log('JSON body being sent:', requestBody)
    
    return apiRequest<Diagram>(`/diagrams/${diagramId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    })
  },

  deleteDiagram: async (diagramId: string, token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/diagrams/${diagramId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },
}

// Token management utilities
export const tokenManager = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null
    
    try {
      // Get the current user's token from the most recent login
      const currentUserEmail = localStorage.getItem('current_user_email')
      if (!currentUserEmail) {
        console.log('No current user email found')
        return null
      }
      
      // Get token for specific user
      const token = localStorage.getItem(`auth_token_${currentUserEmail}`)
      if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
        if (token) {
          localStorage.removeItem(`auth_token_${currentUserEmail}`)
        }
        console.log('No valid token found for user:', currentUserEmail)
        return null
      }
      console.log('Found token for user:', currentUserEmail)
      return token
    } catch (error) {
      console.error('Error getting token from localStorage:', error)
      return null
    }
  },

  set: (token: string, userEmail: string): void => {
    if (typeof window === 'undefined') return
    
    try {
      // Don't save if token is falsy or the string 'undefined'
      if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
        console.warn('Attempting to save invalid token:', token)
        return
      }
      
      if (!userEmail) {
        console.warn('No user email provided for token storage')
        return
      }
      
      // Save token for specific user
      console.log('Saving token to localStorage for user:', userEmail)
      localStorage.setItem(`auth_token_${userEmail}`, token)
      localStorage.setItem('current_user_email', userEmail)
      
      // Clear unauthenticated state
      localStorage.removeItem('unauthenticated')
      console.log('User authenticated successfully:', userEmail)
    } catch (error) {
      console.error('Error saving token to localStorage:', error)
    }
  },

  remove: (): void => {
    if (typeof window === 'undefined') return
    
    try {
      const currentUserEmail = localStorage.getItem('current_user_email')
      
      if (currentUserEmail) {
        // Remove token for specific user
        localStorage.removeItem(`auth_token_${currentUserEmail}`)
        localStorage.removeItem('current_user_email')
        console.log('Token removed from localStorage for user:', currentUserEmail)
      }
      
      // Mark as unauthenticated
      localStorage.setItem('unauthenticated', 'true')
      
      // Also clear user-specific data
      localStorage.removeItem('currentDiagramId')
      localStorage.removeItem('currentProjectId')
      
      // Clear any shared tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('shared-token-')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Error removing token from localStorage:', error)
    }
  },

  // Clean up any existing invalid tokens
  cleanup: (): void => {
    if (typeof window === 'undefined') return
    
    try {
      // Clean up old system
      const token = localStorage.getItem('auth_token')
      if (token === 'undefined' || token === 'null' || (token && token.trim() === '')) {
        console.log('Cleaning up invalid token (legacy)')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('currentDiagramId')
        localStorage.removeItem('currentProjectId')
      }
      
      // Clean up user-specific tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('auth_token_')) {
          const token = localStorage.getItem(key)
          if (token === 'undefined' || token === 'null' || (token && token.trim() === '')) {
            console.log('Cleaning up invalid token for:', key)
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('Error cleaning up token:', error)
    }
  },

  // Get current user email
  getCurrentUserEmail: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('current_user_email')
  }
}