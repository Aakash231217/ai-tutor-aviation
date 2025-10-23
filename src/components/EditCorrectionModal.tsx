'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { AlertCircle, BookOpen, HelpCircle, Target, MoreHorizontal } from 'lucide-react'
import { trpc } from '@/app/_trpc/client'
import { useToast } from './ui/use-toast'

interface EditCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  correction: {
    id: string
    originalMessage: string
    correctedResponse: string | null
    feedbackCategory?: string | null
  }
  onUpdate: () => void
}

const feedbackCategories = [
  {
    value: 'TOO_COMPLEX',
    label: 'Too Complex',
    description: 'The explanation was too difficult to understand',
    icon: <AlertCircle className="h-4 w-4" />
  },
  {
    value: 'INCORRECT_INFO',
    label: 'Incorrect Information',
    description: 'The response contained factual errors',
    icon: <BookOpen className="h-4 w-4" />
  },
  {
    value: 'MISSING_CONTEXT',
    label: 'Missing Context',
    description: 'Important information was left out',
    icon: <HelpCircle className="h-4 w-4" />
  },
  {
    value: 'OFF_TOPIC',
    label: 'Off Topic',
    description: 'The response didn\'t address the question',
    icon: <Target className="h-4 w-4" />
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Another issue not listed above',
    icon: <MoreHorizontal className="h-4 w-4" />
  }
]

export function EditCorrectionModal({ isOpen, onClose, correction, onUpdate }: EditCorrectionModalProps) {
  const { toast } = useToast()
  const [feedbackCategory, setFeedbackCategory] = useState<string>(correction.feedbackCategory || 'OTHER')
  const [correctedResponse, setCorrectedResponse] = useState<string>(correction.correctedResponse || '')
  
  const { mutate: updateCorrection, isLoading } = trpc.updateCorrection.useMutation({
    onSuccess: () => {
      toast({
        title: 'Correction updated',
        description: 'The correction has been updated successfully.',
      })
      onUpdate()
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update the correction. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = () => {
    if (correctedResponse && correctedResponse.trim() !== '') {
      updateCorrection({
        id: correction.id,
        feedbackCategory: feedbackCategory as any,
        correctedResponse: correctedResponse.trim()
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Correction</DialogTitle>
          <DialogDescription>
            Update the correction for this AI response.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Original AI Response</Label>
            <div className="p-3 rounded-md bg-muted text-sm">
              {correction.originalMessage}
            </div>
          </div>

          <div className="space-y-3">
            <Label>What was wrong with this response?</Label>
            <RadioGroup value={feedbackCategory} onValueChange={setFeedbackCategory}>
              {feedbackCategories.map((category) => (
                <div key={category.value} className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value={category.value} id={`edit-${category.value}`} className="mt-1" />
                  <label
                    htmlFor={`edit-${category.value}`}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      {category.icon}
                      <span className="font-medium">{category.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label htmlFor="edit-corrected-response">Corrected Response</Label>
            <Textarea
              id="edit-corrected-response"
              value={correctedResponse}
              onChange={(e) => setCorrectedResponse(e.target.value)}
              placeholder="Edit the response to make it better..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Update the corrected response to improve the AI's learning.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !correctedResponse.trim()}
          >
            {isLoading ? 'Updating...' : 'Update Correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
