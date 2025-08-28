import asyncio
import logging
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from keybert import KeyBERT
import yake
import rapidfuzz
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import nltk

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

logger = logging.getLogger(__name__)

class ExpandWorker:
    def __init__(self):
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.keybert_model = KeyBERT(model='all-MiniLM-L6-v2')
        self.yake_extractor = yake.KeywordExtractor(
            lan="en", 
            n=1, 
            dedupLim=0.9, 
            top=20, 
            features=None
        )
        self.stop_words = set(stopwords.words('english'))
        
    async def expand_keywords(self, seed_keyword: str, project_id: str) -> List[Dict[str, Any]]:
        """
        Expand a seed keyword using multiple techniques
        """
        logger.info(f"Expanding keyword: {seed_keyword}")
        
        # Generate variations using different techniques
        variations = []
        
        # 1. KeyBERT extraction
        try:
            keybert_keywords = self._extract_with_keybert(seed_keyword)
            variations.extend(keybert_keywords)
        except Exception as e:
            logger.error(f"KeyBERT extraction failed: {e}")
        
        # 2. YAKE extraction
        try:
            yake_keywords = self._extract_with_yake(seed_keyword)
            variations.extend(yake_keywords)
        except Exception as e:
            logger.error(f"YAKE extraction failed: {e}")
        
        # 3. Generate variations
        try:
            manual_variations = self._generate_variations(seed_keyword)
            variations.extend(manual_variations)
        except Exception as e:
            logger.error(f"Manual variation generation failed: {e}")
        
        # Deduplicate and clean
        unique_keywords = self._deduplicate_keywords(variations)
        
        # Convert to database format
        keywords = []
        for keyword in unique_keywords[:100]:  # Limit to top 100
            keywords.append({
                'project_id': project_id,
                'keyword': keyword['keyword'],
                'source': keyword['source'],
                'confidence': keyword.get('confidence', 0.5),
                'created_at': 'now()',
                'updated_at': 'now()'
            })
        
        logger.info(f"Generated {len(keywords)} unique keywords")
        return keywords
    
    def _extract_with_keybert(self, seed_keyword: str) -> List[Dict[str, Any]]:
        """Extract keywords using KeyBERT"""
        keywords = self.keybert_model.extract_keywords(
            seed_keyword,
            keyphrase_ngram_range=(1, 3),
            stop_words='english',
            use_maxsum=True,
            nr_candidates=20,
            top_k=10
        )
        
        return [
            {
                'keyword': kw[0],
                'confidence': kw[1],
                'source': 'keybert'
            }
            for kw in keywords
        ]
    
    def _extract_with_yake(self, seed_keyword: str) -> List[Dict[str, Any]]:
        """Extract keywords using YAKE"""
        keywords = self.yake_extractor.extract_keywords(seed_keyword)
        
        return [
            {
                'keyword': kw[0],
                'confidence': 1 - kw[1],  # YAKE returns scores (lower is better)
                'source': 'yake'
            }
            for kw in keywords
        ]
    
    def _generate_variations(self, seed_keyword: str) -> List[Dict[str, Any]]:
        """Generate manual variations of the seed keyword"""
        variations = []
        
        # Tokenize the keyword
        tokens = word_tokenize(seed_keyword.lower())
        
        # Remove stop words
        tokens = [token for token in tokens if token not in self.stop_words]
        
        # Generate variations
        if len(tokens) > 1:
            # Add "how to" prefix
            variations.append({
                'keyword': f"how to {' '.join(tokens)}",
                'confidence': 0.8,
                'source': 'variation'
            })
            
            # Add "best" prefix
            variations.append({
                'keyword': f"best {' '.join(tokens)}",
                'confidence': 0.7,
                'source': 'variation'
            })
            
            # Add "top" prefix
            variations.append({
                'keyword': f"top {' '.join(tokens)}",
                'confidence': 0.7,
                'source': 'variation'
            })
            
            # Add "guide" suffix
            variations.append({
                'keyword': f"{' '.join(tokens)} guide",
                'confidence': 0.6,
                'source': 'variation'
            })
            
            # Add "tips" suffix
            variations.append({
                'keyword': f"{' '.join(tokens)} tips",
                'confidence': 0.6,
                'source': 'variation'
            })
        
        return variations
    
    def _deduplicate_keywords(self, keywords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate keywords using fuzzy matching"""
        unique_keywords = []
        seen_keywords = set()
        
        for kw in keywords:
            keyword_text = kw['keyword'].lower().strip()
            
            # Check if this keyword is similar to any existing one
            is_duplicate = False
            for seen in seen_keywords:
                similarity = rapidfuzz.fuzz.ratio(keyword_text, seen)
                if similarity > 85:  # 85% similarity threshold
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                seen_keywords.add(keyword_text)
                unique_keywords.append(kw)
        
        # Sort by confidence
        unique_keywords.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        return unique_keywords

# Example usage
async def main():
    worker = ExpandWorker()
    keywords = await worker.expand_keywords("digital marketing", "project-123")
    print(f"Generated {len(keywords)} keywords")
    for kw in keywords[:5]:
        print(f"- {kw['keyword']} (confidence: {kw['confidence']:.2f})")

if __name__ == "__main__":
    asyncio.run(main())
