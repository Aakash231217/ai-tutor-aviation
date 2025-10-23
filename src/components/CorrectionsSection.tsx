'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Edit3, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { EditCorrectionModal } from './EditCorrectionModal'

interface Correction {
  id: string
  feedbackCategory?: string | null
  correctedResponse?: string | null
  message: {
    text: string
  }
  createdAt: Date
}

interface CorrectionsSectionProps {
  corrections: Correction[]
  onUpdate?: () => void
}

export function CorrectionsSection({ corrections, onUpdate }: CorrectionsSectionProps) {
  const [editingCorrection, setEditingCorrection] = useState<Correction | null>(null)

  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate()
    }
    // You can add router.refresh() here if needed to refresh server data
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium flex items-center gap-2'>
            <Edit3 className='h-4 w-4' />
            Recent Corrections
          </CardTitle>
          <CardDescription>Improvements made to AI responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {corrections.map((correction) => (
              <div
                key={correction.id}
                className='space-y-3 border-b pb-4 last:border-0'
              >
                <div className='flex items-start justify-between'>
                  <div className='flex-1 space-y-3'>
                    {correction.feedbackCategory && (
                      <Badge variant='outline' className='text-xs'>
                        {correction.feedbackCategory.replace('_', ' ').toLowerCase()}
                      </Badge>
                    )}
                    
                    <div className='space-y-2'>
                      <div className='space-y-1'>
                        <p className='text-xs font-medium text-muted-foreground'>Original Response:</p>
                        <p className='text-sm text-muted-foreground line-clamp-3'>
                          {correction.message.text}
                        </p>
                      </div>
                      
                      <div className='space-y-1'>
                        <p className='text-xs font-medium text-green-600'>Corrected Response:</p>
                        <p className='text-sm line-clamp-3'>
                          {correction.correctedResponse}
                        </p>
                      </div>
                    </div>
                    
                    <p className='text-xs text-muted-foreground'>
                      {format(new Date(correction.createdAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setEditingCorrection(correction)}
                    className='ml-3'
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {editingCorrection && (
        <EditCorrectionModal
          isOpen={!!editingCorrection}
          onClose={() => setEditingCorrection(null)}
          correction={{
            id: editingCorrection.id,
            originalMessage: editingCorrection.message.text,
            correctedResponse: editingCorrection.correctedResponse,
            feedbackCategory: editingCorrection.feedbackCategory,
          }}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}
