"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { apiClient, tokenManager, type User, type AuthResponseNormalized } from '@/lib/api-client'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user is authenticated on app start
  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      try {
        // Clean up any existing invalid tokens first
        tokenManager.cleanup()
        
        // Skip unauthenticated check to allow operations
        console.log('Skipping unauthenticated check')
        
        const token = tokenManager.get()
        console.log('Checking auth with token:', token ? 'Token exists' : 'No token')
        
        if (token) {
          try {
            const userData = await apiClient.me(token)
            const currentUserEmail = tokenManager.getCurrentUserEmail()
            
            // Verify that the user data matches the stored email
            if (userData.email === currentUserEmail) {
              console.log('Auth check successful for user:', userData.username || userData.email)
              setUser(userData)
            } else {
              console.log('User mismatch - expected:', currentUserEmail, 'got:', userData.email)
              // Clear the mismatched token
              tokenManager.remove()
              setUser(null)
            }
          } catch (error) {
            console.error('Auth check failed:', error)
            // Token is invalid, remove it
            tokenManager.remove()
            setUser(null)
          }
        } else {
          // No token, user is not authenticated
          console.log('No token found, user not authenticated')
          setUser(null)
        }
      } catch (error) {
        console.error('Error during auth check:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [mounted])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      console.log('Attempting login with:', { email, password: '***' })
      const response = await apiClient.login({ email, password })
      
      console.log('Login response received:', response)
      
      // Validate response
      if (!response.token || !response.user) {
        console.error('Invalid response structure:', response)
        throw new Error('Invalid login response from server')
      }
      
      console.log('Login successful for user:', response.user.username || response.user.email)
      tokenManager.set(response.token, response.user.email)
      setUser(response.user)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, username: string, password: string) => {
    setIsLoading(true)
    try {
      console.log('Attempting registration with:', { email, username, password: '***' })
      const response = await apiClient.register({ email, username, password })
      
      console.log('Registration response received:', response)
      
      // After successful registration, automatically log in
      await login(email, password)
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    console.log('Logging out current user')
    tokenManager.remove()
    setUser(null)
    // Clear any cached data
    localStorage.removeItem('currentDiagramId')
    localStorage.removeItem('currentProjectId')
    // Clear any shared tokens
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('shared-token-')) {
        localStorage.removeItem(key)
      }
    })
    // Clear unauthenticated state
    localStorage.removeItem('unauthenticated')
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, isLoading: true, login, register, logout }}>
        <div suppressHydrationWarning={true}>
          {children}
        </div>
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}