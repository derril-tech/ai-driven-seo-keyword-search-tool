import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import LatentDirichletAllocation, NMF
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.metrics import silhouette_score, calinski_harabasz_score
from sklearn.manifold import TSNE
import hdbscan
from sentence_transformers import SentenceTransformer
import networkx as nx
from collections import defaultdict
import json
from dataclasses import dataclass
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

@dataclass
class ClusterNode:
    id: str
    keywords: List[str]
    centroid: List[float]
    label: str
    size: int
    level: int
    parent_id: Optional[str] = None
    children: List[str] = None
    topic_distribution: Dict[str, float] = None
    metadata: Dict[str, Any] = None

@dataclass
class TopicModel:
    id: str
    topics: List[Dict[str, Any]]
    topic_keywords: Dict[int, List[str]]
    coherence_score: float
    perplexity: float
    created_at: datetime

class AdvancedClusteringWorker:
    def __init__(self):
        self.logger = logger
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Clustering algorithms
        self.clustering_methods = {
            'hierarchical': AgglomerativeClustering,
            'kmeans': KMeans,
            'hdbscan': hdbscan.HDBSCAN,
            'lda': LatentDirichletAllocation,
            'nmf': NMF
        }
    
    async def perform_advanced_clustering(self, keywords: List[Dict[str, Any]], 
                                        method: str = 'hierarchical',
                                        **kwargs) -> Dict[str, Any]:
        """Perform advanced clustering with multiple methods"""
        try:
            self.logger.info(f"Starting advanced clustering with method: {method}")
            
            # Extract keyword texts
            keyword_texts = [kw.get('keyword', '') for kw in keywords]
            
            # Generate embeddings
            embeddings = await self._generate_embeddings(keyword_texts)
            
            # Perform clustering based on method
            if method == 'hierarchical':
                clusters = await self._hierarchical_clustering(embeddings, keywords, **kwargs)
            elif method == 'topic_modeling':
                clusters = await self._topic_modeling_clustering(keyword_texts, keywords, **kwargs)
            elif method == 'hybrid':
                clusters = await self._hybrid_clustering(embeddings, keyword_texts, keywords, **kwargs)
            else:
                raise ValueError(f"Unsupported clustering method: {method}")
            
            # Build cluster hierarchy
            hierarchy = await self._build_cluster_hierarchy(clusters)
            
            # Generate topic model
            topic_model = await self._generate_topic_model(keyword_texts, clusters)
            
            # Calculate cluster metrics
            metrics = await self._calculate_cluster_metrics(embeddings, clusters)
            
            result = {
                'clusters': clusters,
                'hierarchy': hierarchy,
                'topic_model': topic_model,
                'metrics': metrics,
                'method': method,
                'parameters': kwargs
            }
            
            self.logger.info(f"Advanced clustering completed: {len(clusters)} clusters")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in advanced clustering: {e}")
            raise
    
    async def _hierarchical_clustering(self, embeddings: np.ndarray, 
                                     keywords: List[Dict[str, Any]], 
                                     n_clusters: int = None,
                                     linkage: str = 'ward',
                                     distance_threshold: float = None) -> List[Dict[str, Any]]:
        """Perform hierarchical clustering"""
        try:
            if n_clusters is None:
                # Estimate optimal number of clusters
                n_clusters = await self._estimate_optimal_clusters(embeddings)
            
            # Perform hierarchical clustering
            clustering = AgglomerativeClustering(
                n_clusters=n_clusters,
                linkage=linkage,
                distance_threshold=distance_threshold
            )
            
            cluster_labels = clustering.fit_predict(embeddings)
            
            # Create cluster objects
            clusters = await self._create_cluster_objects(keywords, cluster_labels, embeddings)
            
            return clusters
            
        except Exception as e:
            self.logger.error(f"Error in hierarchical clustering: {e}")
            raise
    
    async def _topic_modeling_clustering(self, keyword_texts: List[str], 
                                       keywords: List[Dict[str, Any]], 
                                       n_topics: int = 10,
                                       method: str = 'lda') -> List[Dict[str, Any]]:
        """Perform topic modeling clustering"""
        try:
            # Vectorize text
            vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            tfidf_matrix = vectorizer.fit_transform(keyword_texts)
            feature_names = vectorizer.get_feature_names_out()
            
            # Apply topic modeling
            if method == 'lda':
                topic_model = LatentDirichletAllocation(
                    n_components=n_topics,
                    random_state=42,
                    max_iter=100
                )
            else:  # NMF
                topic_model = NMF(
                    n_components=n_topics,
                    random_state=42,
                    max_iter=100
                )
            
            topic_distributions = topic_model.fit_transform(tfidf_matrix)
            
            # Assign keywords to dominant topics
            cluster_labels = np.argmax(topic_distributions, axis=1)
            
            # Create cluster objects with topic information
            clusters = await self._create_topic_clusters(keywords, cluster_labels, topic_distributions, feature_names, topic_model)
            
            return clusters
            
        except Exception as e:
            self.logger.error(f"Error in topic modeling clustering: {e}")
            raise
    
    async def _hybrid_clustering(self, embeddings: np.ndarray, 
                               keyword_texts: List[str], 
                               keywords: List[Dict[str, Any]], 
                               n_clusters: int = None) -> List[Dict[str, Any]]:
        """Perform hybrid clustering combining semantic and topic modeling"""
        try:
            # Step 1: Semantic clustering
            semantic_clusters = await self._hierarchical_clustering(embeddings, keywords, n_clusters)
            
            # Step 2: Topic modeling within each semantic cluster
            refined_clusters = []
            
            for cluster in semantic_clusters:
                cluster_keywords = [kw for kw in keywords if kw.get('cluster_id') == cluster['id']]
                cluster_texts = [kw.get('keyword', '') for kw in cluster_keywords]
                
                if len(cluster_texts) > 5:  # Only apply topic modeling to larger clusters
                    # Generate embeddings for cluster keywords
                    cluster_embeddings = await self._generate_embeddings(cluster_texts)
                    
                    # Apply topic modeling
                    topic_clusters = await self._topic_modeling_clustering(
                        cluster_texts, 
                        cluster_keywords, 
                        n_topics=min(3, len(cluster_texts) // 2)
                    )
                    
                    # Refine cluster with topic information
                    refined_cluster = await self._refine_cluster_with_topics(cluster, topic_clusters)
                    refined_clusters.append(refined_cluster)
                else:
                    refined_clusters.append(cluster)
            
            return refined_clusters
            
        except Exception as e:
            self.logger.error(f"Error in hybrid clustering: {e}")
            raise
    
    async def _build_cluster_hierarchy(self, clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build hierarchical structure from clusters"""
        try:
            hierarchy = {
                'root': {
                    'id': 'root',
                    'label': 'All Keywords',
                    'children': [],
                    'level': 0,
                    'size': sum(cluster['size'] for cluster in clusters)
                }
            }
            
            # Group clusters by similarity
            cluster_groups = await self._group_similar_clusters(clusters)
            
            # Build hierarchy levels
            for level, group in enumerate(cluster_groups, 1):
                for group_clusters in group:
                    parent_node = {
                        'id': f"level_{level}_{len(hierarchy)}",
                        'label': f"Group {len(hierarchy)}",
                        'children': [c['id'] for c in group_clusters],
                        'level': level,
                        'size': sum(c['size'] for c in group_clusters)
                    }
                    hierarchy[parent_node['id']] = parent_node
                    hierarchy['root']['children'].append(parent_node['id'])
            
            return hierarchy
            
        except Exception as e:
            self.logger.error(f"Error building cluster hierarchy: {e}")
            raise
    
    async def _generate_topic_model(self, keyword_texts: List[str], 
                                  clusters: List[Dict[str, Any]]) -> TopicModel:
        """Generate topic model from clustered keywords"""
        try:
            # Vectorize all texts
            vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            tfidf_matrix = vectorizer.fit_transform(keyword_texts)
            feature_names = vectorizer.get_feature_names_out()
            
            # Apply LDA
            n_topics = min(10, len(keyword_texts) // 10)
            lda = LatentDirichletAllocation(
                n_components=n_topics,
                random_state=42,
                max_iter=100
            )
            
            topic_distributions = lda.fit_transform(tfidf_matrix)
            
            # Extract topics
            topics = []
            topic_keywords = {}
            
            for topic_idx, topic in enumerate(lda.components_):
                top_words_idx = topic.argsort()[-10:][::-1]
                top_words = [feature_names[i] for i in top_words_idx]
                topic_keywords[topic_idx] = top_words
                
                topics.append({
                    'id': topic_idx,
                    'words': top_words,
                    'weights': topic[top_words_idx].tolist(),
                    'coherence': await self._calculate_topic_coherence(top_words, keyword_texts)
                })
            
            # Calculate model metrics
            coherence_score = np.mean([t['coherence'] for t in topics])
            perplexity = lda.perplexity(tfidf_matrix)
            
            topic_model = TopicModel(
                id=str(uuid.uuid4()),
                topics=topics,
                topic_keywords=topic_keywords,
                coherence_score=coherence_score,
                perplexity=perplexity,
                created_at=datetime.utcnow()
            )
            
            return topic_model
            
        except Exception as e:
            self.logger.error(f"Error generating topic model: {e}")
            raise
    
    async def _estimate_optimal_clusters(self, embeddings: np.ndarray) -> int:
        """Estimate optimal number of clusters using elbow method and silhouette analysis"""
        try:
            max_clusters = min(20, len(embeddings) // 5)
            if max_clusters < 2:
                return 2
            
            inertias = []
            silhouette_scores = []
            k_range = range(2, max_clusters + 1)
            
            for k in k_range:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                cluster_labels = kmeans.fit_predict(embeddings)
                
                inertias.append(kmeans.inertia_)
                silhouette_scores.append(silhouette_score(embeddings, cluster_labels))
            
            # Find elbow point
            elbow_k = await self._find_elbow_point(k_range, inertias)
            
            # Find best silhouette score
            best_silhouette_k = k_range[np.argmax(silhouette_scores)]
            
            # Choose the smaller of the two for more conservative clustering
            optimal_k = min(elbow_k, best_silhouette_k)
            
            self.logger.info(f"Optimal clusters estimated: {optimal_k} (elbow: {elbow_k}, silhouette: {best_silhouette_k})")
            return optimal_k
            
        except Exception as e:
            self.logger.error(f"Error estimating optimal clusters: {e}")
            return 5  # Default fallback
    
    async def _find_elbow_point(self, k_range: range, inertias: List[float]) -> int:
        """Find elbow point in inertia curve"""
        try:
            # Calculate second derivative
            second_derivative = np.diff(np.diff(inertias))
            
            # Find the point with maximum second derivative
            elbow_idx = np.argmax(second_derivative) + 2  # +2 because of double diff
            
            return k_range[elbow_idx] if elbow_idx < len(k_range) else k_range[-1]
            
        except Exception as e:
            self.logger.error(f"Error finding elbow point: {e}")
            return 5  # Default fallback
    
    async def _create_cluster_objects(self, keywords: List[Dict[str, Any]], 
                                    cluster_labels: np.ndarray, 
                                    embeddings: np.ndarray) -> List[Dict[str, Any]]:
        """Create cluster objects from labels"""
        try:
            clusters = []
            unique_labels = np.unique(cluster_labels)
            
            for label in unique_labels:
                if label == -1:  # Skip noise points
                    continue
                
                # Get keywords in this cluster
                cluster_indices = np.where(cluster_labels == label)[0]
                cluster_keywords = [keywords[i] for i in cluster_indices]
                cluster_embeddings = embeddings[cluster_indices]
                
                # Calculate centroid
                centroid = np.mean(cluster_embeddings, axis=0).tolist()
                
                # Generate cluster label
                cluster_label = await self._generate_cluster_label(cluster_keywords)
                
                cluster_obj = {
                    'id': str(uuid.uuid4()),
                    'label': cluster_label,
                    'keywords': [kw.get('keyword', '') for kw in cluster_keywords],
                    'keyword_data': cluster_keywords,
                    'centroid': centroid,
                    'size': len(cluster_keywords),
                    'density': await self._calculate_cluster_density(cluster_embeddings),
                    'created_at': datetime.utcnow()
                }
                
                # Update keyword cluster assignments
                for kw in cluster_keywords:
                    kw['cluster_id'] = cluster_obj['id']
                    kw['cluster_label'] = cluster_label
                
                clusters.append(cluster_obj)
            
            return clusters
            
        except Exception as e:
            self.logger.error(f"Error creating cluster objects: {e}")
            raise
    
    async def _create_topic_clusters(self, keywords: List[Dict[str, Any]], 
                                   cluster_labels: np.ndarray, 
                                   topic_distributions: np.ndarray,
                                   feature_names: np.ndarray,
                                   topic_model) -> List[Dict[str, Any]]:
        """Create cluster objects with topic information"""
        try:
            clusters = []
            unique_labels = np.unique(cluster_labels)
            
            for label in unique_labels:
                # Get keywords in this topic cluster
                cluster_indices = np.where(cluster_labels == label)[0]
                cluster_keywords = [keywords[i] for i in cluster_indices]
                
                # Get topic distribution for this cluster
                cluster_topic_dist = np.mean(topic_distributions[cluster_indices], axis=0)
                
                # Get top words for this topic
                top_words_idx = topic_model.components_[label].argsort()[-10:][::-1]
                top_words = [feature_names[i] for i in top_words_idx]
                
                cluster_obj = {
                    'id': str(uuid.uuid4()),
                    'label': f"Topic {label + 1}: {', '.join(top_words[:3])}",
                    'keywords': [kw.get('keyword', '') for kw in cluster_keywords],
                    'keyword_data': cluster_keywords,
                    'topic_id': label,
                    'topic_words': top_words,
                    'topic_distribution': cluster_topic_dist.tolist(),
                    'size': len(cluster_keywords),
                    'created_at': datetime.utcnow()
                }
                
                # Update keyword cluster assignments
                for kw in cluster_keywords:
                    kw['cluster_id'] = cluster_obj['id']
                    kw['cluster_label'] = cluster_obj['label']
                    kw['topic_id'] = label
                
                clusters.append(cluster_obj)
            
            return clusters
            
        except Exception as e:
            self.logger.error(f"Error creating topic clusters: {e}")
            raise
    
    async def _group_similar_clusters(self, clusters: List[Dict[str, Any]]) -> List[List[List[Dict[str, Any]]]]:
        """Group similar clusters for hierarchy building"""
        try:
            # Extract centroids
            centroids = np.array([cluster['centroid'] for cluster in clusters])
            
            # Calculate similarity matrix
            similarity_matrix = np.dot(centroids, centroids.T)
            
            # Group clusters by similarity threshold
            threshold = 0.7
            groups = []
            used_clusters = set()
            
            for i, cluster in enumerate(clusters):
                if i in used_clusters:
                    continue
                
                group = [cluster]
                used_clusters.add(i)
                
                for j, other_cluster in enumerate(clusters):
                    if j not in used_clusters and similarity_matrix[i, j] > threshold:
                        group.append(other_cluster)
                        used_clusters.add(j)
                
                groups.append(group)
            
            # Organize groups by level
            levels = []
            current_level = groups
            
            while current_level:
                levels.append(current_level)
                # Create next level by grouping similar groups
                current_level = await self._group_cluster_groups(current_level)
            
            return levels
            
        except Exception as e:
            self.logger.error(f"Error grouping similar clusters: {e}")
            raise
    
    async def _group_cluster_groups(self, groups: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        """Group similar cluster groups for next hierarchy level"""
        try:
            if len(groups) <= 1:
                return []
            
            # Calculate group centroids
            group_centroids = []
            for group in groups:
                centroids = [cluster['centroid'] for cluster in group]
                group_centroid = np.mean(centroids, axis=0)
                group_centroids.append(group_centroid)
            
            group_centroids = np.array(group_centroids)
            
            # Calculate similarity matrix
            similarity_matrix = np.dot(group_centroids, group_centroids.T)
            
            # Group similar groups
            threshold = 0.6
            new_groups = []
            used_groups = set()
            
            for i, group in enumerate(groups):
                if i in used_groups:
                    continue
                
                new_group = group.copy()
                used_groups.add(i)
                
                for j, other_group in enumerate(groups):
                    if j not in used_groups and similarity_matrix[i, j] > threshold:
                        new_group.extend(other_group)
                        used_groups.add(j)
                
                new_groups.append(new_group)
            
            return new_groups if len(new_groups) < len(groups) else []
            
        except Exception as e:
            self.logger.error(f"Error grouping cluster groups: {e}")
            raise
    
    async def _calculate_cluster_metrics(self, embeddings: np.ndarray, 
                                       clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate clustering quality metrics"""
        try:
            # Prepare cluster labels
            cluster_labels = []
            cluster_embeddings = []
            
            for cluster in clusters:
                cluster_keywords = cluster['keyword_data']
                cluster_indices = [i for i, kw in enumerate(cluster_keywords) if kw.get('cluster_id') == cluster['id']]
                cluster_emb = embeddings[cluster_indices]
                
                cluster_embeddings.extend(cluster_emb)
                cluster_labels.extend([cluster['id']] * len(cluster_emb))
            
            cluster_embeddings = np.array(cluster_embeddings)
            cluster_labels = np.array(cluster_labels)
            
            # Calculate metrics
            silhouette_avg = silhouette_score(cluster_embeddings, cluster_labels) if len(np.unique(cluster_labels)) > 1 else 0
            calinski_harabasz = calinski_harabasz_score(cluster_embeddings, cluster_labels) if len(np.unique(cluster_labels)) > 1 else 0
            
            metrics = {
                'silhouette_score': silhouette_avg,
                'calinski_harabasz_score': calinski_harabasz,
                'total_clusters': len(clusters),
                'total_keywords': len(cluster_embeddings),
                'avg_cluster_size': len(cluster_embeddings) / len(clusters) if clusters else 0,
                'cluster_sizes': [cluster['size'] for cluster in clusters]
            }
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error calculating cluster metrics: {e}")
            raise
    
    async def _generate_cluster_label(self, cluster_keywords: List[Dict[str, Any]]) -> str:
        """Generate descriptive label for cluster"""
        try:
            # Extract common words from keywords
            keywords = [kw.get('keyword', '').lower() for kw in cluster_keywords]
            
            # Simple word frequency analysis
            word_freq = defaultdict(int)
            for keyword in keywords:
                words = keyword.split()
                for word in words:
                    if len(word) > 3:  # Skip short words
                        word_freq[word] += 1
            
            # Get most common words
            common_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:3]
            
            if common_words:
                label = f"Cluster: {', '.join([word for word, freq in common_words])}"
            else:
                label = f"Cluster {len(cluster_keywords)} keywords"
            
            return label
            
        except Exception as e:
            self.logger.error(f"Error generating cluster label: {e}")
            return "Unnamed Cluster"
    
    async def _calculate_cluster_density(self, cluster_embeddings: np.ndarray) -> float:
        """Calculate cluster density (average pairwise distance)"""
        try:
            if len(cluster_embeddings) < 2:
                return 0.0
            
            # Calculate pairwise distances
            distances = []
            for i in range(len(cluster_embeddings)):
                for j in range(i + 1, len(cluster_embeddings)):
                    dist = np.linalg.norm(cluster_embeddings[i] - cluster_embeddings[j])
                    distances.append(dist)
            
            return np.mean(distances) if distances else 0.0
            
        except Exception as e:
            self.logger.error(f"Error calculating cluster density: {e}")
            return 0.0
    
    async def _calculate_topic_coherence(self, topic_words: List[str], 
                                       documents: List[str]) -> float:
        """Calculate topic coherence score"""
        try:
            # Simple coherence calculation based on word co-occurrence
            coherence_score = 0.0
            word_pairs = 0
            
            for i, word1 in enumerate(topic_words):
                for j, word2 in enumerate(topic_words[i+1:], i+1):
                    # Count co-occurrences
                    co_occurrences = sum(1 for doc in documents if word1 in doc.lower() and word2 in doc.lower())
                    total_docs = len(documents)
                    
                    if total_docs > 0:
                        coherence_score += co_occurrences / total_docs
                    word_pairs += 1
            
            return coherence_score / word_pairs if word_pairs > 0 else 0.0
            
        except Exception as e:
            self.logger.error(f"Error calculating topic coherence: {e}")
            return 0.0
    
    async def _refine_cluster_with_topics(self, cluster: Dict[str, Any], 
                                        topic_clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Refine semantic cluster with topic information"""
        try:
            # Merge topic information into semantic cluster
            refined_cluster = cluster.copy()
            
            # Add topic information
            refined_cluster['sub_topics'] = []
            for topic_cluster in topic_clusters:
                refined_cluster['sub_topics'].append({
                    'id': topic_cluster['id'],
                    'label': topic_cluster['label'],
                    'keywords': topic_cluster['keywords'],
                    'topic_words': topic_cluster.get('topic_words', [])
                })
            
            return refined_cluster
            
        except Exception as e:
            self.logger.error(f"Error refining cluster with topics: {e}")
            return cluster
    
    async def _generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for text list"""
        try:
            embeddings = self.sentence_model.encode(texts)
            return embeddings
            
        except Exception as e:
            self.logger.error(f"Error generating embeddings: {e}")
            raise
