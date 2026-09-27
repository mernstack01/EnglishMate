import {
  BookOpen,
  Layers,
  PenLine,
  CircleAlert,
  ChartNoAxesCombined,
  Sprout,
} from "lucide-react";
export const modules = {
  learn: {
    title: "A little practice. A brighter day.",
    eyebrow: "YOUR DAILY LEARNING",
    description:
      "A personal mix of vocabulary reviews, new words, and grammar practice will meet you here. Short sessions, designed to fit into real life.",
    icon: Sprout,
    items: [
      "A session that fits your day",
      "Practice shaped around your progress",
      "One simple place to start",
    ],
  },
  vocabulary: {
    title: "New words, new possibilities.",
    eyebrow: "YOUR VOCABULARY",
    description:
      "A home for the words you want to remember. Soon, you’ll collect vocabulary and revisit it at just the right time.",
    icon: BookOpen,
    items: [
      "Your own collection of words",
      "Reviews that help memories stick",
      "Examples that bring words to life",
    ],
  },
  synonyms: {
    title: "There’s more than one way to say it.",
    eyebrow: "YOUR SYNONYMS",
    description:
      "Find the right word for the moment. You’ll explore related words and learn the little differences that make your English more natural.",
    icon: Layers,
    items: [
      "Build a richer vocabulary",
      "Explore words in context",
      "Practice choosing the right fit",
    ],
  },
  grammar: {
    title: "A little clarity goes a long way.",
    eyebrow: "YOUR GRAMMAR",
    description:
      "Make sense of English, one idea at a time. Clear explanations and focused practice will help you write and speak with more confidence.",
    icon: PenLine,
    items: [
      "Approachable grammar topics",
      "Focused practice exercises",
      "Learn from helpful explanations",
    ],
  },
  mistakes: {
    title: "Every mistake has something to teach.",
    eyebrow: "YOUR LEARNING NOTES",
    description:
      "Your personal space to revisit tricky moments. You’ll spot patterns, understand what went wrong, and give it another go.",
    icon: CircleAlert,
    items: [
      "Keep track of tricky moments",
      "Notice patterns in your learning",
      "Turn practice into confidence",
    ],
  },
  progress: {
    title: "Look how far you’ll go.",
    eyebrow: "YOUR PROGRESS",
    description:
      "Small efforts add up. Your learning history, study streaks, and growing vocabulary will come together here as you practice.",
    icon: ChartNoAxesCombined,
    items: [
      "See your vocabulary grow",
      "Celebrate consistent practice",
      "Reflect on your learning journey",
    ],
  },
} as const;
