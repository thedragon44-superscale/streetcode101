import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, 
  TextInput, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, RefreshControl 
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";
const { width } = Dimensions.get('window');

// Helper to highlight @mentions in React Native text nodes
const parseMentions = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <Text key={i} style={styles.mentionText}>{part}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
};

export default function FeedScreen() {
  const router = useRouter();
  
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState('global'); // 'global' or 'following'
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Comment Section State
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Mention Auto-complete State
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
    const paddingToBottom = 150;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(0, feedType);
    setRefreshing(false);
  }, [feedType]);

  useEffect(() => {
    fetchFeed(0, feedType);
  }, [feedType]);
  // Mention Suggestions Fetcher
  useEffect(() => {
    if (showMentionDropdown && mentionQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(mentionQuery)}`)
        .then(res => res.json())
        .then(data => setMentionSuggestions(data.users || []))
        .catch(err => console.error(err));
    } else {
      setMentionSuggestions([]);
    }
  }, [mentionQuery, showMentionDropdown]);

  const fetchFeed = async (pageIndex: number, type: string) => {
    if (pageIndex === 0) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const offset = pageIndex * 20;
      const res = await fetch(`${API_BASE}/posts/feed?filter=${type}&offset=${offset}&limit=20`, { headers });
      if (!res.ok) throw new Error('Failed to load feed');
      const data = await res.json();
      
      if (pageIndex === 0) {
        setFeed(data);
      } else {
        setFeed(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === 20);
      setPage(pageIndex);
    } catch (err) {
      Alert.alert("Error", "Failed to load timeline.");
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const loadMore = () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    fetchFeed(page + 1, feedType);
  };

  const handleLike = async (postId: number) => {
    const token = await SecureStore.getItemAsync('pidrop_token');
    if (!token) return Alert.alert("Hold up", "You must be logged in to like drops!");
    
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like post');
      const data = await res.json();
      
      // Optimistic UI update
      setFeed(prevFeed => prevFeed.map(p => {
        if (p.id === postId) {
          return { ...p, likes_count: data.liked ? (p.likes_count || 0) + 1 : (p.likes_count || 1) - 1 };
        }
        return p;
      }));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleToggleComments = async (postId: number) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }
    setActiveCommentPostId(postId);
    setPostComments([]); 
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setPostComments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentChange = (text: string) => {
    setCommentInput(text);
    // Mobile mention tracking: check if the last typed word starts with @
    const words = text.split(' ');
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('@')) {
      setMentionQuery(lastWord.substring(1));
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (username: string) => {
    const words = commentInput.split(' ');
    words.pop(); // Remove the partial @mention
    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${username} `;
    
    setCommentInput(newText);
    setShowMentionDropdown(false);
  };

  const handlePostComment = async (postId: number) => {
    if (!commentInput.trim()) return;
    
    const token = await SecureStore.getItemAsync('pidrop_token');
    if (!token) return Alert.alert("Hold up", "You must be logged in to comment!");

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentInput })
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const newComment = await res.json();
      
      setPostComments([...postComments, newComment]);
      setCommentInput('');
      
      setFeed(prevFeed => prevFeed.map(p => 
        p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      ));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const switchFeedType = async (type: string) => {
    if (type === 'following') {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) return Alert.alert("Hold up", "Log in to see your following feed!");
    }
    setFeedType(type);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      
      {/* CUSTOM HEADER PLACED SECURELY AT THE TOP OF THE SCREEN */}
      <Header />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        onScroll={({ nativeEvent }) => {
          if (isCloseToBottom(nativeEvent) && hasMore && !isFetchingMore) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SOCIAL FEED</Text>
          <Text style={styles.headerSubtitle}>Live drops from the community ledger.</Text>
          
          <View style={styles.controlsRow}>
            <View style={styles.toggleBox}>
              <TouchableOpacity 
                style={[styles.toggleBtn, feedType === 'global' && styles.toggleBtnActive]}
                onPress={() => switchFeedType('global')}
              >
                <Text style={[styles.toggleBtnText, feedType === 'global' && styles.toggleBtnTextActive]}>GLOBAL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleBtn, feedType === 'following' && styles.toggleBtnActive]}
                onPress={() => switchFeedType('following')}
              >
                <Text style={[styles.toggleBtnText, feedType === 'following' && styles.toggleBtnTextActive]}>FOLLOWING</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.postBtn}>
              <Text style={styles.postBtnText}>POST</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerElements}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : feed.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>The feed is empty.</Text>
            <Text style={styles.emptySubtitle}>Be the first to post a listing!</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {feed.map((post) => (
              <View key={post.id} style={styles.postCard}>
                
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <TouchableOpacity 
                    style={styles.postHeaderLeft}
                    onPress={() => router.push(`/profile/${post.username}`)}
                  >
                    <Image source={{ uri: post.user_avatar || 'https://streetcode101.com/favicon.ico' }} style={styles.avatar} />
                    <View>
                      <Text style={styles.username}>@{post.username}</Text>
                      <View style={styles.timeRow}>
                        <Text style={styles.timeText}>
                          {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}
                        </Text>
                        {post.post_type === 'vendor_drop' && (
                          <View style={styles.dropBadge}><Text style={styles.dropBadgeText}>DROP</Text></View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  {post.post_type === 'vendor_drop' && post.price && (
                    <Text style={styles.priceText}>${Number(post.price).toFixed(2)}</Text>
                  )}
                </View>

                {/* Post Image */}
                {post.post_type !== 'text' && post.image_url && (
                  <View style={styles.postImageContainer}>
                    <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="contain" />
                  </View>
                )}

                {/* Post Body */}
                <View style={styles.postBody}>
                  {post.post_type === 'vendor_drop' && post.title && (
                    <Text style={styles.postTitle}>{post.title}</Text>
                  )}
                  <Text style={styles.postDescription}>{parseMentions(post.description)}</Text>
                  
                  {/* Engagement Bar */}
                  <View style={styles.engagementBar}>
                    <View style={styles.engagementLeft}>
                      <TouchableOpacity onPress={() => handleLike(post.id)} style={styles.actionBtn}>
                        <Text style={styles.actionIcon}>❤️</Text>
                        <Text style={styles.actionText}>{post.likes_count || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleToggleComments(post.id)} style={styles.actionBtn}>
                        <Text style={styles.actionIcon}>💬</Text>
                        <Text style={[styles.actionText, activeCommentPostId === post.id && styles.actionTextActive]}>
                          {post.comments_count || 0}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.messageBtn}>
                      <Text style={styles.messageBtnText}>MESSAGE</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Comment Section */}
                {activeCommentPostId === post.id && (
                  <View style={styles.commentSection}>
                    
                    {/* Render Comments */}
                    {postComments.length === 0 ? (
                      <Text style={styles.noCommentsText}>NO COMMENTS YET.</Text>
                    ) : (
                      postComments.map((c) => (
                        <View key={c.id} style={styles.commentBubble}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentUsername}>@{c.username}</Text>
                            <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleDateString()}</Text>
                          </View>
                          <Text style={styles.commentText}>{parseMentions(c.text)}</Text>
                        </View>
                      ))
                    )}

                    {/* Mention Dropdown Overlay */}
                    {showMentionDropdown && mentionSuggestions.length > 0 && (
                      <View style={styles.mentionDropdown}>
                        {mentionSuggestions.map(u => (
                          <TouchableOpacity 
                            key={u.username} 
                            style={styles.mentionItem}
                            onPress={() => handleSelectMention(u.username)}
                          >
                            <Image source={{ uri: u.profile_image_url || 'https://streetcode101.com/favicon.ico' }} style={styles.mentionAvatar} />
                            <Text style={styles.mentionUsername}>@{u.username}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Comment Input */}
                    <View style={styles.commentInputRow}>
                      <TextInput 
                        style={styles.commentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor="#94a3b8"
                        value={commentInput}
                        onChangeText={handleCommentChange}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity 
                        style={[styles.commentSubmitBtn, isSubmittingComment && { opacity: 0.5 }]}
                        onPress={() => handlePostComment(post.id)}
                        disabled={isSubmittingComment}
                      >
                        <Text style={styles.commentSubmitText}>POST</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {hasMore && feed.length > 0 && !loading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            {isFetchingMore && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#f97316" />
                <Text style={styles.loadMoreText}>LOADING NEXT 20...</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 15, paddingBottom: 50 },
  centerElements: { padding: 50, alignItems: 'center' },
  
  mentionText: { color: '#06b6d4', fontWeight: 'bold' },

  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  headerSubtitle: { fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 15 },
  
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleBox: { flexDirection: 'row', backgroundColor: 'white', padding: 4, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', flex: 1, marginRight: 10 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#0f172a' },
  toggleBtnText: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  toggleBtnTextActive: { color: 'white' },
  
  postBtn: { backgroundColor: '#f97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  postBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  emptyBox: { backgroundColor: 'white', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  emptySubtitle: { fontSize: 12, color: '#64748b' },

  feedList: { gap: 20 },
  postCard: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9' },
  username: { fontWeight: '900', color: '#0f172a', fontSize: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  timeText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
  dropBadge: { backgroundColor: '#ffedd5', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  dropBadgeText: { color: '#ea580c', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  priceText: { fontSize: 20, fontWeight: '900', color: '#059669' },

  postImageContainer: { width: '100%', height: 300, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  postImage: { width: '100%', height: '100%' },

  postBody: { padding: 15 },
  postTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', marginBottom: 5, letterSpacing: 0.5 },
  postDescription: { fontSize: 13, color: '#475569', lineHeight: 20 },
  
  engagementBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  engagementLeft: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 14 },
  actionText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  actionTextActive: { color: '#0891b2' },
  messageBtn: { paddingVertical: 5 },
  messageBtnText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },

  commentSection: { backgroundColor: '#f8fafc', padding: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  noCommentsText: { textAlign: 'center', fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, paddingVertical: 10, marginBottom: 10 },
  commentBubble: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentUsername: { fontSize: 11, fontWeight: '900', color: '#0f172a' },
  commentTime: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold' },
  commentText: { fontSize: 12, color: '#475569', lineHeight: 18 },

  commentInputRow: { flexDirection: 'row', gap: 10, marginTop: 5, zIndex: 1 },
  commentInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10, fontSize: 13 },
  commentSubmitBtn: { backgroundColor: '#0f172a', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 10 },
  commentSubmitText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  mentionDropdown: { position: 'absolute', bottom: 55, left: 0, width: 250, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, zIndex: 100 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  mentionAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9' },
  mentionUsername: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },

  loadMoreBtn: { backgroundColor: 'white', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  loadMoreText: { color: '#0f172a', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
