import asyncio
import logging
from typing import Dict, Any, List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import hdbscan
from sklearn.metrics import silhouette_score
import uuid

logger = logging.getLogger(__name__)

class ClusterWorker:
    def __init__(self):
        self.logger = logger
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        
    async def cluster_keywords(self, keywords: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Cluster keywords based on semantic similarity"""
        try:
            if not keywords:
                return {
                    'clusters': [],
                    'metadata': {
                        'total_clusters': 0,
                        'avg_cluster_size': 0,
                        'silhouette_score': 0
                    }
                }
            
            # Generate embeddings if not provided
            if not keywords[0].get('embedding'):
                embeddings = self._generate_embeddings(keywords)
            else:
                embeddings = np.array([kw['embedding'] for kw in keywords])
            
            # Perform clustering
            cluster_labels = self._perform_clustering(embeddings)
            
            # Create cluster objects
            clusters = self._create_cluster_objects(keywords, cluster_labels, embeddings)
            
            # Calculate metadata
            metadata = self._calculate_cluster_metadata(clusters, embeddings, cluster_labels)
            
            return {
                'clusters': clusters,
                'metadata': metadata
            }
            
        except Exception as e:
            self.logger.error(f"Error clustering keywords: {e}")
            return {
                'clusters': [],
                'metadata': {
                    'total_clusters': 0,
                    'avg_cluster_size': 0,
                    'silhouette_score': 0
                }
            }
    
    def _generate_embeddings(self, keywords: List[Dict[str, Any]]) -> np.ndarray:
        """Generate embeddings for keywords"""
        texts = [kw['keyword'] for kw in keywords]
        embeddings = self.sentence_model.encode(texts)
        return embeddings
    
    def _perform_clustering(self, embeddings: np.ndarray) -> np.ndarray:
        """Perform HDBSCAN clustering"""
        # Configure HDBSCAN parameters
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=2,
            min_samples=1,
            metric='euclidean',
            cluster_selection_method='eom'
        )
        
        cluster_labels = clusterer.fit_predict(embeddings)
        return cluster_labels
    
    def _create_cluster_objects(self, keywords: List[Dict[str, Any]], 
                               cluster_labels: np.ndarray, 
                               embeddings: np.ndarray) -> List[Dict[str, Any]]:
        """Create cluster objects from clustering results"""
        clusters = []
        unique_clusters = set(cluster_labels)
        
        for cluster_id in unique_clusters:
            if cluster_id == -1:  # Skip noise points
                continue
                
            # Get keywords in this cluster
            cluster_indices = np.where(cluster_labels == cluster_id)[0]
            cluster_keywords = [keywords[i] for i in cluster_indices]
            cluster_embeddings = embeddings[cluster_indices]
            
            # Calculate centroid
            centroid = self._calculate_centroid(cluster_embeddings)
            
            # Generate cluster label
            label = self._generate_cluster_label(cluster_keywords)
            
            # Calculate metrics
            metrics = self._calculate_cluster_metrics(cluster_keywords)
            
            cluster_obj = {
                'id': str(uuid.uuid4()),
                'label': label,
                'keywords': cluster_keywords,
                'centroid': centroid,
                'metrics': metrics
            }
            
            clusters.append(cluster_obj)
        
        return clusters
    
    def _calculate_centroid(self, embeddings: np.ndarray) -> List[float]:
        """Calculate centroid of embeddings"""
        return embeddings.mean(axis=0).tolist()
    
    def _generate_cluster_label(self, cluster_keywords: List[Dict[str, Any]]) -> str:
        """Generate a descriptive label for the cluster"""
        # Extract common terms from keywords
        keywords_text = [kw['keyword'].lower() for kw in cluster_keywords]
        
        # Find most common words (excluding stop words)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        
        word_counts = {}
        for keyword in keywords_text:
            words = keyword.split()
            for word in words:
                if word not in stop_words and len(word) > 2:
                    word_counts[word] = word_counts.get(word, 0) + 1
        
        # Get top 2 most common words
        if word_counts:
            top_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:2]
            label = ' '.join([word for word, count in top_words])
        else:
            # Fallback to first keyword
            label = cluster_keywords[0]['keyword']
        
        return label.title()
    
    def _calculate_cluster_metrics(self, cluster_keywords: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate metrics for a cluster"""
        if not cluster_keywords:
            return {}
        
        # Calculate averages
        search_volumes = [kw.get('search_volume', 0) for kw in cluster_keywords]
        difficulties = [kw.get('difficulty', 50) for kw in cluster_keywords]
        
        avg_search_volume = np.mean(search_volumes) if search_volumes else 0
        avg_difficulty = np.mean(difficulties) if difficulties else 50
        
        # Calculate intent distribution
        intents = [kw.get('intent', 'unknown') for kw in cluster_keywords]
        intent_counts = {}
        for intent in intents:
            intent_counts[intent] = intent_counts.get(intent, 0) + 1
        
        return {
            'avg_search_volume': round(avg_search_volume, 2),
            'avg_difficulty': round(avg_difficulty, 2),
            'total_keywords': len(cluster_keywords),
            'intent_distribution': intent_counts
        }
    
    def _calculate_cluster_metadata(self, clusters: List[Dict[str, Any]], 
                                   embeddings: np.ndarray, 
                                   cluster_labels: np.ndarray) -> Dict[str, Any]:
        """Calculate overall clustering metadata"""
        total_clusters = len(clusters)
        
        if total_clusters == 0:
            return {
                'total_clusters': 0,
                'avg_cluster_size': 0,
                'silhouette_score': 0
            }
        
        # Calculate average cluster size
        cluster_sizes = [len(cluster['keywords']) for cluster in clusters]
        avg_cluster_size = np.mean(cluster_sizes)
        
        # Calculate silhouette score (if we have multiple clusters)
        silhouette = 0
        if total_clusters > 1 and len(set(cluster_labels)) > 1:
            try:
                # Remove noise points for silhouette calculation
                valid_indices = cluster_labels != -1
                if np.sum(valid_indices) > 1:
                    valid_labels = cluster_labels[valid_indices]
                    valid_embeddings = embeddings[valid_indices]
                    silhouette = silhouette_score(valid_embeddings, valid_labels)
            except Exception as e:
                self.logger.warning(f"Could not calculate silhouette score: {e}")
        
        return {
            'total_clusters': total_clusters,
            'avg_cluster_size': round(avg_cluster_size, 2),
            'silhouette_score': round(silhouette, 3)
        }
