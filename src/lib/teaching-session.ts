// In-memory session storage for teaching state
// In production, this should be moved to Redis or database

interface QuizSession {
  fileId: string
  chapterNumber: number
  questions: any[]
  currentQuestionIndex: number
  answers: { questionId: string; answer: string; isCorrect: boolean }[]
  score: number
  startedAt: Date
}

interface TeachingSession {
  fileId: string
  isQuizMode: boolean
  quizSession?: QuizSession
  lastActivity: Date
  teachingPhase: 'greeting' | 'chapter_intro' | 'teaching' | 'quiz' | 'chapter_complete'
}

class TeachingSessionManager {
  private sessions: Map<string, TeachingSession> = new Map()
  
  getSession(fileId: string): TeachingSession | null {
    const session = this.sessions.get(fileId)
    if (session) {
      // Update last activity
      session.lastActivity = new Date()
    }
    return session || null
  }
  
  createSession(fileId: string): TeachingSession {
    const session: TeachingSession = {
      fileId,
      isQuizMode: false,
      lastActivity: new Date(),
      teachingPhase: 'greeting'
    }
    this.sessions.set(fileId, session)
    return session
  }
  
  updateSession(fileId: string, updates: Partial<TeachingSession>) {
    const session = this.getSession(fileId)
    if (session) {
      Object.assign(session, updates)
      this.sessions.set(fileId, session)
    }
  }
  
  startQuiz(fileId: string, chapterNumber: number, questions: any[]) {
    const session = this.getSession(fileId) || this.createSession(fileId)
    
    const quizSession: QuizSession = {
      fileId,
      chapterNumber,
      questions,
      currentQuestionIndex: 0,
      answers: [],
      score: 0,
      startedAt: new Date()
    }
    
    session.isQuizMode = true
    session.quizSession = quizSession
    session.teachingPhase = 'quiz'
    this.sessions.set(fileId, session)
    
    return quizSession
  }
  
  getCurrentQuestion(fileId: string): any | null {
    const session = this.getSession(fileId)
    if (!session?.quizSession) return null
    
    const { questions, currentQuestionIndex } = session.quizSession
    return questions[currentQuestionIndex] || null
  }
  
  submitAnswer(fileId: string, answer: string): { isCorrect: boolean; explanation: string; isQuizComplete: boolean } {
    const session = this.getSession(fileId)
    if (!session?.quizSession) {
      throw new Error('No active quiz session')
    }
    
    const currentQuestion = this.getCurrentQuestion(fileId)
    if (!currentQuestion) {
      throw new Error('No current question')
    }
    
    const isCorrect = answer === currentQuestion.correctAnswer
    
    // Record answer
    session.quizSession.answers.push({
      questionId: currentQuestion.id,
      answer,
      isCorrect
    })
    
    if (isCorrect) {
      session.quizSession.score++
    }
    
    // Move to next question
    session.quizSession.currentQuestionIndex++
    
    const isQuizComplete = session.quizSession.currentQuestionIndex >= session.quizSession.questions.length
    
    if (isQuizComplete) {
      session.isQuizMode = false
      session.teachingPhase = 'chapter_complete'
    }
    
    this.sessions.set(fileId, session)
    
    return {
      isCorrect,
      explanation: currentQuestion.explanation,
      isQuizComplete
    }
  }
  
  getQuizResults(fileId: string): { score: number; total: number; percentage: number } | null {
    const session = this.getSession(fileId)
    if (!session?.quizSession) return null
    
    const total = session.quizSession.questions.length
    const score = session.quizSession.score
    const percentage = Math.round((score / total) * 100)
    
    return { score, total, percentage }
  }
  
  // Clean up old sessions (run periodically)
  cleanupOldSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    for (const [fileId, session] of this.sessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.sessions.delete(fileId)
      }
    }
  }
}

// Export singleton instance
export const teachingSessionManager = new TeachingSessionManager()
