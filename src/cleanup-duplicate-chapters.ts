/**
 * Cleanup script to remove duplicate chapters from the database
 * Run this if you're experiencing "Unique constraint failed" errors
 */

import { db } from './db'

async function cleanupDuplicateChapters() {
  console.log('🧹 Starting duplicate chapter cleanup...')
  
  try {
    // Get all files with chapters
    const files = await db.file.findMany({
      include: {
        chapters: {
          orderBy: {
            id: 'asc'
          }
        }
      }
    })
    
    let totalDuplicatesRemoved = 0
    
    for (const file of files) {
      const chapterNumbersSeen = new Set<number>()
      const duplicateIds: string[] = []
      
      for (const chapter of file.chapters) {
        if (chapterNumbersSeen.has(chapter.chapterNumber)) {
          // This is a duplicate
          duplicateIds.push(chapter.id)
        } else {
          chapterNumbersSeen.add(chapter.chapterNumber)
        }
      }
      
      if (duplicateIds.length > 0) {
        console.log(`📄 File: ${file.name}`)
        console.log(`   Found ${duplicateIds.length} duplicate chapters`)
        
        // Delete duplicates
        const result = await db.chapter.deleteMany({
          where: {
            id: {
              in: duplicateIds
            }
          }
        })
        
        console.log(`   ✅ Removed ${result.count} duplicates`)
        totalDuplicatesRemoved += result.count
      }
    }
    
    if (totalDuplicatesRemoved === 0) {
      console.log('✨ No duplicates found! Database is clean.')
    } else {
      console.log(`\n🎉 Cleanup complete! Removed ${totalDuplicatesRemoved} duplicate chapters.`)
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Run the cleanup
cleanupDuplicateChapters()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })
