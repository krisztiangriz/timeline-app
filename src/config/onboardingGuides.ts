import type { GuideDefinition } from '../hooks/useOnboardingGuides'

export const onboardingGuides: GuideDefinition[] = [
  {
    id: 'home-intro',
    steps: [
      {
        description: 'Hubs group related pages — think of them as folders for your work.',
        video: '/timeline-app/first-hub.mp4',
      },
      {
        description: 'Drag pages into hubs to keep things organized.',
        video: '/timeline-app/drag-pages.mp4',
      },
    ],
  },
  {
    id: 'pending-tasks',
    steps: [
      {
        description: 'Type pending tasks here — checking them off moves them to today\'s log.',
        video: '/timeline-app/pending-tasks.mp4',
      },
    ],
  },
  {
    id: 'editor-walkthrough',
    steps: [
      {
        description: 'Format with shortcuts and customize page mention triggers.',
        video: '/timeline-app/editor-walkthrough.mp4',
      },
    ],
  },
  {
    id: 'visualization-charts',
    steps: [
      {
        description: 'Add charts to visualize your activity, and feedback trends.',
        video: '/timeline-app/visualization-charts.mp4',
      },
    ],
  },
]
