import type { GuideDefinition } from '../hooks/useOnboardingGuides'

export const onboardingGuides: GuideDefinition[] = [
  {
    id: 'home-intro',
    steps: [
      {
        title: 'Your First Hub',
        description: 'Hubs group related pages — think of them as folders for your work.',
        video: '/timeline-app/first-hub.mp4',
      },
      {
        title: 'Organize with Drag & Drop',
        description: 'Drag pages into hubs to keep things organized.',
        video: '/timeline-app/drag-pages.mp4',
      },
    ],
  },
  {
    id: 'pending-tasks',
    steps: [
      {
        title: 'Pending Tasks',
        description: 'Type tasks here — checking them off moves them to today\'s log.',
        video: '/timeline-app/pending-tasks.mp4',
      },
    ],
  },
  {
    id: 'editor-walkthrough',
    steps: [
      {
        title: 'Rich Text Editor',
        description: 'Format with shortcuts, type @ to mention pages, and use ~ to insert blocks.',
        video: '/timeline-app/editor-walkthrough.mp4',
      },
    ],
  },
  {
    id: 'visualization-charts',
    steps: [
      {
        title: 'Visualizations',
        description: 'Add charts to visualize your activity, feedback trends, or team stats.',
        video: '/timeline-app/visualization-charts.mp4',
      },
    ],
  },
]
