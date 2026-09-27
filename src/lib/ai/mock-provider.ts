import type {
  AiProvider,
  CandidateToEnrich,
  EnrichedVocabulary,
  ExtractedCandidate,
} from "./types";

export class MockAiProvider implements AiProvider {
  readonly name = "MOCK" as const;
  public readonly model = "mock-model";
  private customCandidates?: ExtractedCandidate[];
  private shouldFailExtraction = false;
  private shouldFailEnrichment = false;
  private shouldReturnMalformed = false;
  private shouldReturnEmpty = false;

  constructor(options?: {
    candidates?: ExtractedCandidate[];
    failExtraction?: boolean;
    failEnrichment?: boolean;
    malformed?: boolean;
    empty?: boolean;
  }) {
    if (options?.candidates) this.customCandidates = options.candidates;
    if (options?.failExtraction) this.shouldFailExtraction = true;
    if (options?.failEnrichment) this.shouldFailEnrichment = true;
    if (options?.malformed) this.shouldReturnMalformed = true;
    if (options?.empty) this.shouldReturnEmpty = true;
  }

  async extractVocabularyFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedCandidate[]> {
    void imageBuffer;
    void mimeType;
    if (this.shouldFailExtraction) {
      throw new Error("Simulated extraction error from mock AI.");
    }
    if (this.shouldReturnMalformed) {
      throw new Error("Simulated malformed JSON output from AI.");
    }
    if (this.shouldReturnEmpty) {
      return [];
    }
    if (this.customCandidates) {
      return this.customCandidates;
    }

    // Default realistic textbook candidates
    return [
      {
        id: "mock_1",
        word: "appropriate",
        confidence: 0.96,
        markingType: "HIGHLIGHTED",
        context: "This dress is appropriate for the business meeting.",
      },
      {
        id: "mock_2",
        word: "look after",
        confidence: 0.92,
        markingType: "UNDERLINED",
        context: "She had to look after her younger brother after school.",
      },
      {
        id: "mock_3",
        word: "participate",
        confidence: 0.89,
        markingType: "CIRCLED",
        context:
          "All students are encouraged to participate in classroom discussions.",
      },
      {
        id: "mock_4",
        word: "essential",
        confidence: 0.84,
        markingType: "BOXED",
        context: "Clean water is essential for human health and survival.",
      },
      {
        id: "mock_5",
        word: "maybe",
        confidence: 0.65,
        markingType: "PEN_MARK",
        context: "Maybe we can meet at the library tomorrow.",
      },
    ];
  }

  async enrichVocabulary(
    candidates: CandidateToEnrich[],
  ): Promise<EnrichedVocabulary[]> {
    if (this.shouldFailEnrichment) {
      throw new Error("Simulated enrichment error from mock AI.");
    }

    const dict: Record<string, Partial<EnrichedVocabulary>> = {
      appropriate: {
        translation: "mos, munosib",
        definition: "suitable or right for a particular situation or occasion",
        example: "This dress is appropriate for the business meeting.",
        partOfSpeech: "adjective",
        pronunciation: "/əˈprəʊpriət/",
        synonyms: ["suitable", "proper", "fitting"],
      },
      "look after": {
        translation: "g'amxo'rlik qilmoq, qaramoq",
        definition:
          "to take care of or be responsible for someone or something",
        example: "She had to look after her younger brother after school.",
        partOfSpeech: "phrasal verb",
        pronunciation: "/lʊk ˈɑːftər/",
        synonyms: ["take care of", "mind", "attend to"],
      },
      participate: {
        translation: "qatnashmoq, ishtirok etmoq",
        definition: "to take part in or become involved in an activity",
        example: "All students are encouraged to participate in discussions.",
        partOfSpeech: "verb",
        pronunciation: "/pɑːˈtɪsɪpeɪt/",
        synonyms: ["take part", "join in", "engage"],
      },
      essential: {
        translation: "zarur, o'ta muhim",
        definition: "completely necessary or extremely important",
        example: "Clean water is essential for human health.",
        partOfSpeech: "adjective",
        pronunciation: "/ɪˈsenʃl/",
        synonyms: ["vital", "crucial", "necessary"],
      },
      maybe: {
        translation: "balki, ehtimol",
        definition: "used to show that something is possible or may happen",
        example: "Maybe we can meet tomorrow.",
        partOfSpeech: "adverb",
        pronunciation: "/ˈmeɪbi/",
        synonyms: ["perhaps", "possibly"],
      },
    };

    return candidates.map((cand) => {
      const lower = cand.word.toLowerCase().trim();
      const meta = dict[lower] || {
        translation: `${cand.word} tarjimasi`,
        definition: `A definition for ${cand.word}`,
        example: cand.context || `An example sentence using ${cand.word}.`,
        partOfSpeech: "word",
        pronunciation: `/${cand.word}/`,
        synonyms: ["related", "similar"],
      };

      return {
        id: cand.id,
        word: cand.word,
        translation: meta.translation || `${cand.word} tarjimasi`,
        definition: meta.definition || "",
        example: meta.example || cand.context || "",
        partOfSpeech: meta.partOfSpeech || "word",
        pronunciation: meta.pronunciation || "",
        synonyms: meta.synonyms || [],
      };
    });
  }

  async enrichSingleWord(
    word: string,
    context?: string,
  ): Promise<EnrichedVocabulary> {
    const res = await this.enrichVocabulary([{ id: "single", word, context }]);
    return res[0];
  }
}
