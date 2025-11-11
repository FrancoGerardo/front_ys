"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Send, Bot, Upload, Image, MessageCircle } from "lucide-react"
import { generateUMLDiagramFromPrompt, generateUMLDiagramFromImage, chatWithAI, modifyExistingDiagram, type ChatMessage } from "@/lib/gemini-service"
import type { UMLClass, Association } from "@/types/uml"

interface AIAssistantPanelProps {
	isOpen: boolean
	onClose: () => void
	onGenerateClasses: (classes: UMLClass[]) => void
	onGenerateAssociations: (associations: Association[]) => void
	existingClasses?: UMLClass[]
	existingAssociations?: Association[]
}

export function AIAssistantPanel({ 
  isOpen, 
  onClose, 
  onGenerateClasses,
  onGenerateAssociations,
  existingClasses = [],
  existingAssociations = []
}: AIAssistantPanelProps) {
  const [prompt, setPrompt] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatMode, setIsChatMode] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [modificationMode, setModificationMode] = useState(false)
  const [modificationPrompt, setModificationPrompt] = useState("")
  const [isModifying, setIsModifying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      let response
      
      if (selectedImage && prompt.trim()) {
        // Both image and text prompt
        response = await generateUMLDiagramFromImage(selectedImage, prompt)
      } else if (selectedImage) {
        // Only image
        response = await generateUMLDiagramFromImage(selectedImage)
      } else {
        // Only text prompt
        response = await generateUMLDiagramFromPrompt(prompt)
      }

      if (response.success && response.diagram && response.diagram.classes && response.diagram.associations) {
        onGenerateClasses(response.diagram.classes)
        onGenerateAssociations(response.diagram.associations)
        setPrompt("")
        setSelectedImage(null)
        setError(null)
      } else {
        setError(response.error || response.message)
      }
    } catch (error) {
      setError("Error generating diagram")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleModifyDiagram = async () => {
    if (!modificationPrompt.trim()) return
    
    setIsModifying(true)
    setError(null)
    
    try {
      const response = await modifyExistingDiagram(
        existingClasses,
        existingAssociations,
        modificationPrompt
      )

      if (response.success && response.diagram && response.diagram.classes && response.diagram.associations) {
        onGenerateClasses(response.diagram.classes)
        onGenerateAssociations(response.diagram.associations)
        setModificationPrompt("")
        setModificationMode(false)
        setError(null)
      } else {
        setError(response.error || response.message)
      }
    } catch (error) {
      setError("Error modifying diagram")
    } finally {
      setIsModifying(false)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput("")
    setIsChatLoading(true)
    
    try {
      const aiResponse = await chatWithAI(chatInput, chatMessages)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date()
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble responding right now. Please try again.",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file && file.type.startsWith('image/')) {
			setSelectedImage(file)
		}
	}

	return (
		<>
			{/* Overlay */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/20 z-40"
					onClick={onClose}
				/>
			)}

			{/* Panel */}
			<div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'
				}`}>


				{/* Content */}
				<div className="flex flex-col h-full">

					{/* Header */}
					<div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Bot className="w-5 h-5" />
								<h2 className="font-semibold">AI Diagram Assistant</h2>
							</div>
							<Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/20">
								<X className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{/* Mode Toggle */}
					<div className="p-4 border-b bg-gray-50">
						<div className="flex gap-2">
							<Button
								onClick={() => setIsChatMode(false)}
								variant={!isChatMode ? "default" : "outline"}
								size="sm"
								className="flex-1"
							>
								<Bot className="w-4 h-4 mr-2" />
								Generate
							</Button>
							<Button
								onClick={() => setIsChatMode(true)}
								variant={isChatMode ? "default" : "outline"}
								size="sm"
								className="flex-1"
							>
								<MessageCircle className="w-4 h-4 mr-2" />
								Chat
							</Button>
						</div>
					</div>
					
					{!isChatMode ? (
						/* Generation Mode */
						<>
							<div className="flex-1 overflow-y-auto p-6 space-y-6">
								{/* Mode Selection */}
								<div className="flex gap-2 mb-4">
									<Button
										variant={!modificationMode ? "default" : "outline"}
										size="sm"
										onClick={() => setModificationMode(false)}
									>
										Create New
									</Button>
									<Button
										variant={modificationMode ? "default" : "outline"}
										size="sm"
										onClick={() => setModificationMode(true)}
										disabled={existingClasses.length === 0}
									>
										Modify Existing
									</Button>
								</div>

								{modificationMode ? (
									/* Modification Mode */
									<div className="space-y-3">
										<Label className="text-sm font-medium text-gray-700">
											Modify existing diagram
										</Label>
										<Input
											value={modificationPrompt}
											onChange={(e) => setModificationPrompt(e.target.value)}
											placeholder="e.g. Add a User class, modify Product to include price..."
											className="w-full"
										/>
										<Button
											onClick={handleModifyDiagram}
											disabled={!modificationPrompt.trim() || isModifying}
											className="w-full"
										>
											{isModifying ? (
												<>
													<Bot className="w-4 h-4 mr-2 animate-spin" />
													Modifying...
												</>
											) : (
												<>
													<Bot className="w-4 h-4 mr-2" />
													Modify Diagram
												</>
											)}
										</Button>
									</div>
								) : (
									/* Creation Mode */
									<>
										{/* Text Prompt */}
										<div className="space-y-3">
											<Label className="text-sm font-medium text-gray-700">
												Describe your system
											</Label>
											<Input
												value={prompt}
												onChange={(e) => setPrompt(e.target.value)}
												placeholder="e.g. Create a library management system..."
												className="w-full"
											/>
										</div>

								{/* Image Upload */}
								<div className="space-y-3">
									<Label className="text-sm font-medium text-gray-700">
										Attach image (optional)
									</Label>
									<div className="flex gap-2">
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											onChange={handleImageSelect}
											className="hidden"
										/>
										<Button
											onClick={() => fileInputRef.current?.click()}
											variant="outline"
											className="flex-1"
										>
											<Upload className="w-4 h-4 mr-2" />
											Upload Image
										</Button>
										{selectedImage && (
											<Button
												onClick={() => setSelectedImage(null)}
												variant="outline"
												size="sm"
											>
												<X className="w-4 h-4" />
											</Button>
										)}
									</div>

									{selectedImage && (
										<div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
											<Image className="w-4 h-4 text-gray-500" />
											<span className="text-sm text-gray-600 truncate">
												{selectedImage.name}
											</span>
										</div>
									)}
								</div>

								{/* Error Display */}
								{error && (
									<div className="p-3 bg-red-50 border border-red-200 rounded-lg">
										<p className="text-sm text-red-600">{error}</p>
									</div>
								)}
									</>
								)}
							</div>

							{/* Generate Button - Only show in creation mode */}
							{!modificationMode && (
								<div className="p-6 border-t">
									<Button
										onClick={handleGenerate}
										disabled={(!prompt.trim() && !selectedImage) || isGenerating}
										className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
									>
										{isGenerating ? (
											<div className="flex items-center gap-2">
												<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												Generating...
											</div>
										) : (
											<div className="flex items-center gap-2">
												<Send className="w-4 h-4" />
												Generate Diagram
											</div>
										)}
									</Button>
								</div>
							)}
						</>
					) : (
						/* Chat Mode */
						<>
							<div className="flex-1 overflow-y-auto p-4">
								{chatMessages.length === 0 ? (
									<div className="text-center text-gray-500 mt-8">
										<Bot className="w-8 h-8 mx-auto mb-2 text-gray-400" />
										<p className="text-sm">Ask me anything about UML diagrams!</p>
									</div>
								) : (
									<div className="space-y-4">
										{chatMessages.map((message) => (
											<div
												key={message.id}
												className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
											>
												<div
													className={`max-w-[80%] p-3 rounded-lg ${
														message.role === 'user'
															? 'bg-purple-600 text-white'
															: 'bg-gray-100 text-gray-900'
													}`}
												>
													<p className="text-sm whitespace-pre-wrap">{message.content}</p>
													<p className={`text-xs mt-1 ${
														message.role === 'user' ? 'text-purple-200' : 'text-gray-500'
													}`}>
														{message.timestamp.toLocaleTimeString()}
													</p>
												</div>
											</div>
										))}
										{isChatLoading && (
											<div className="flex justify-start">
												<div className="bg-gray-100 p-3 rounded-lg">
													<div className="flex items-center gap-2">
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
													</div>
												</div>
											</div>
										)}
									</div>
								)}
							</div>

							{/* Chat Input */}
							<div className="p-4 border-t">
								<div className="flex gap-2">
									<Input
										value={chatInput}
										onChange={(e) => setChatInput(e.target.value)}
										placeholder="Ask about UML design patterns, best practices..."
										onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
										className="flex-1"
									/>
									<Button
										onClick={handleChatSend}
										disabled={!chatInput.trim() || isChatLoading}
										className="bg-purple-600 hover:bg-purple-700"
									>
										<Send className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	)
}

