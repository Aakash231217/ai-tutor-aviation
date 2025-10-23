'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { AlertCircle, BookOpen, HelpCircle, Target, MoreHorizontal } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  originalMessage: string
  onSubmit: (data: {
    feedbackCategory: string
    correctedResponse: string
  }) => void
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

export function FeedbackModal({ isOpen, onClose, originalMessage, onSubmit }: FeedbackModalProps) {
  const [feedbackCategory, setFeedbackCategory] = useState<string>('')
  const [correctedResponse, setCorrectedResponse] = useState<string>(originalMessage)

  const handleSubmit = () => {
    if (feedbackCategory && correctedResponse && correctedResponse !== originalMessage) {
      onSubmit({
        feedbackCategory,
        correctedResponse
      })
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Improve AI Response</DialogTitle>
          <DialogDescription>
            Help us improve by telling us what was wrong and providing a better response.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>What was wrong with this response?</Label>
            <RadioGroup value={feedbackCategory} onValueChange={setFeedbackCategory}>
              {feedbackCategories.map((category) => (
                <div key={category.value} className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value={category.value} id={category.value} className="mt-1" />
                  <label
                    htmlFor={category.value}
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
            <Label htmlFor="corrected-response">Corrected Response</Label>
            <Textarea
              id="corrected-response"
              value={correctedResponse}
              onChange={(e) => setCorrectedResponse(e.target.value)}
              placeholder="Edit the response to make it better..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Edit the AI's response to provide a better answer. This will help improve future responses.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!feedbackCategory || correctedResponse === originalMessage}
          >
            Submit Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
