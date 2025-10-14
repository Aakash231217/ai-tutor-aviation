'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/app/_trpc/client'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Trophy, Target } from 'lucide-react'

interface StudentProgressProps {
  fileId: string
}

export const StudentProgress = ({ fileId }: StudentProgressProps) => {
  const [progress, setProgress] = useState<any>(null)
  
  const { data: chapters } = trpc.getChapters.useQuery({ fileId })
  const { data: studentProgress } = trpc.getStudentProgress.useQuery({ fileId })
  
  useEffect(() => {
    if (studentProgress) {
      setProgress(studentProgress)
    }
  }, [studentProgress])
  
  if (!chapters || !progress) return null
  
  const totalChapters = chapters.length
  const completedChapters = progress.completedChapters?.length || 0
  const progressPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Learning Progress
        </h3>
        <span className="text-xs text-gray-500">
          Chapter {progress.currentChapter} of {totalChapters}
        </span>
      </div>
      
      <Progress value={progressPercentage} className="h-2 mb-3" />
      
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-blue-500" />
          <span>{completedChapters} chapters completed</span>
        </div>
        
        {completedChapters === totalChapters && (
          <div className="flex items-center gap-1 text-green-600">
            <Trophy className="h-3 w-3" />
            <span>Course Complete!</span>
          </div>
        )}
      </div>
      
      {progress.quizScores && Object.keys(progress.quizScores).length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium mb-1">Quiz Scores:</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(progress.quizScores).map(([chapter, score]: [string, any]) => (
              <span key={chapter} className="text-xs bg-gray-100 px-2 py-1 rounded">
                Ch.{chapter}: {score}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
