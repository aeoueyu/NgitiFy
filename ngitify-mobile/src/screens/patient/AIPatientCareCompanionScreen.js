import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { AuthContext } from '../../context/AuthContext';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';

const QUICK_PROMPTS = [
  {
    id: 'visit-recommendation',
    icon: 'calendar-outline',
    label: 'Explain my current visit recommendation',
  },
  {
    id: 'oral-health-trend',
    icon: 'analytics-outline',
    label: 'Explain my recent Oral Health Management trend',
  },
  {
    id: 'radiograph-findings',
    icon: 'image-outline',
    label: 'Explain my radiograph findings',
  },
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! How can I help? Ask about your appointments, Electronic Medical Record (EMR), daily care, or how NgitiFy works.\n\nNgitiBot can explain your saved information but does not replace your dentist.',
};

const formatDateKey = (value) => {
  if (!value) return '';

  const normalized = String(value).trim();
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (match) {
    const [, year, month, day] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getChatErrorMessage = (
  status,
  payload,
) => {
  if (status === 429) {
    return 'The AI request limit has been reached for now. Your System Recommendation and other core NgitiFy features are still available.';
  }

  if (status === 503) {
    return 'The AI explanation service is temporarily unavailable. Your System Recommendation, Oral Health Management, and Dental Health Education are still available.';
  }

  if (status === 409) {
    return (
      payload?.message
      || 'This conversation cannot receive new messages right now.'
    );
  }

  return (
    payload?.message
    || 'The AI explanation could not be loaded. Please try again.'
  );
};

const normalizePersistedMessages = (
  messages = [],
) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message) =>
        ['user', 'assistant'].includes(
          message?.role,
        )
        && String(
          message?.content || '',
        ).trim(),
    )
    .map(
      (
        message,
        index,
      ) => ({
        id:
          message?.id
          || message?._id
          || `${message?.role || 'message'}-${index}`,
        role:
          message.role,
        content:
          String(
            message.content,
          ).trim(),
      }),
    );
};

export default function AiPatientCareCompanionScreen({
  navigation,
  embedded = false,
  onClose,
}) {
  const {
    userToken,
    API_BASE_URL,
  } = useContext(AuthContext);

  const [
    visitInfo,
    setVisitInfo,
  ] = useState(null);

  const [
    oralHealth,
    setOralHealth,
  ] = useState(null);

  const [
    careLoading,
    setCareLoading,
  ] = useState(true);

  const [
    careError,
    setCareError,
  ] = useState('');

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    archivedConversations,
    setArchivedConversations,
  ] = useState([]);

  const [
    conversationsLoading,
    setConversationsLoading,
  ] = useState(true);

  const [
    conversationsError,
    setConversationsError,
  ] = useState('');

  const [
    currentConversation,
    setCurrentConversation,
  ] = useState(null);

  const [
    openingConversation,
    setOpeningConversation,
  ] = useState(false);

  const [
    messages,
    setMessages,
  ] = useState([
    WELCOME_MESSAGE,
  ]);

  const [
    input,
    setInput,
  ] = useState('');

  const [
    keyboardInset,
    setKeyboardInset,
  ] = useState(0);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    chatError,
    setChatError,
  ] = useState('');

  const [
    lastFailedPrompt,
    setLastFailedPrompt,
  ] = useState('');

  const [
    chatsVisible,
    setChatsVisible,
  ] = useState(false);

  const [
    chatsView,
    setChatsView,
  ] = useState('active');

  const [
    infoVisible,
    setInfoVisible,
  ] = useState(false);

  const [
    activeChatOverlay,
    setActiveChatOverlay,
  ] = useState(null);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [
    pendingArchiveState,
    setPendingArchiveState,
  ] = useState(null);

  const [
    renameValue,
    setRenameValue,
  ] = useState('');

  const [
    managementBusy,
    setManagementBusy,
  ] = useState(false);

  const scrollRef = useRef(null);

  const conversationCacheRef =
    useRef(new Map());

  const openConversationRequestRef =
    useRef(0);

  const conversationMutationVersionRef =
    useRef(new Map());

  const authHeaders = {
    Authorization: `Bearer ${userToken}`,
  };

  const fetchCareSnapshot =
    useCallback(async () => {
      if (
        !userToken
        || !API_BASE_URL
      ) {
        setCareLoading(false);
        setCareError(
          'Your patient session is unavailable.',
        );
        return;
      }

      setCareLoading(true);
      setCareError('');

      try {
        const [
          predictionResponse,
          oralHealthResponse,
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/my/visit-prediction`,
            {
              headers: authHeaders,
            },
          ),
          fetch(
            `${API_BASE_URL}/api/my/oral-health`,
            {
              headers: authHeaders,
            },
          ),
        ]);

        if (!predictionResponse.ok) {
          throw new Error(
            'Recommended Visit Window could not be loaded.',
          );
        }

        if (!oralHealthResponse.ok) {
          throw new Error(
            'Oral Health Management could not be loaded.',
          );
        }

        const predictionPayload =
          await predictionResponse.json();

        const oralHealthPayload =
          await oralHealthResponse.json();

        setVisitInfo(
          predictionPayload?.prediction
          || null,
        );

        setOralHealth(
          oralHealthPayload
          && typeof oralHealthPayload
            === 'object'
            ? oralHealthPayload
            : null,
        );
      } catch (error) {
        setCareError(
          error.message
          || 'Your current care information could not be loaded.',
        );
      } finally {
        setCareLoading(false);
      }
    }, [
      API_BASE_URL,
      userToken,
    ]);

  const fetchConversationList =
    useCallback(
      async ({
        archived = false,
      } = {}) => {
        if (
          !userToken
          || !API_BASE_URL
        ) {
          return [];
        }

        const response = await fetch(
          `${API_BASE_URL}/api/my/ai-conversations?archived=${
            archived
              ? 'true'
              : 'false'
          }`,
          {
            headers: authHeaders,
          },
        );

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.message
            || 'Saved conversations could not be loaded.',
          );
        }

        return Array.isArray(
          payload?.conversations,
        )
          ? payload.conversations
          : [];
      },
      [
        API_BASE_URL,
        userToken,
      ],
    );

  const refreshConversationLists =
    useCallback(
      async ({
        quiet = false,
      } = {}) => {
        if (
          !userToken
          || !API_BASE_URL
        ) {
          setConversationsLoading(
            false,
          );
          return;
        }

        if (!quiet) {
          setConversationsLoading(
            true,
          );
        }

        setConversationsError('');

        try {
          const [
            active,
            archived,
          ] = await Promise.all([
            fetchConversationList({
              archived: false,
            }),
            fetchConversationList({
              archived: true,
            }),
          ]);

          setConversations(active);
          setArchivedConversations(
            archived,
          );
        } catch (error) {
          setConversationsError(
            error.message
            || 'Saved conversations could not be loaded.',
          );
        } finally {
          setConversationsLoading(
            false,
          );
        }
      },
      [
        API_BASE_URL,
        fetchConversationList,
        userToken,
      ],
    );

  const openConversation =
    useCallback(
      async (
        conversation,
        {
          closeChats = true,
        } = {},
      ) => {
        const conversationId =
          typeof conversation === 'string'
            ? conversation
            : conversation?.id;

        const conversationSummary =
          typeof conversation === 'object'
            ? conversation
            : null;

        if (
          !conversationId
          || !userToken
          || !API_BASE_URL
          || sending
        ) {
          return;
        }

        const requestId =
          openConversationRequestRef
            .current + 1;

        openConversationRequestRef
          .current =
          requestId;

        setChatError('');
        setLastFailedPrompt('');

        const cachedConversation =
          conversationCacheRef.current.get(
            conversationId,
          );

        if (cachedConversation) {
          const cachedMessages =
            normalizePersistedMessages(
              cachedConversation.messages,
            );

          setCurrentConversation(
            cachedConversation,
          );

          setMessages(
            cachedMessages.length
              ? cachedMessages
              : [WELCOME_MESSAGE],
          );

          setOpeningConversation(
            false,
          );
        } else {
          setCurrentConversation(
            conversationSummary
            || {
              id: conversationId,
              title: 'Conversation',
            },
          );

          setMessages([]);

          setOpeningConversation(
            true,
          );
        }

        setInput('');

        if (closeChats) {
          setChatsView('active');
          setActiveChatOverlay(null);
          setChatsVisible(false);
        }

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/my/ai-conversations/${conversationId}`,
            {
              headers: authHeaders,
            },
          );

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload?.message
              || 'This conversation could not be opened.',
            );
          }

          const persistedConversation =
            payload?.conversation
            || null;

          if (!persistedConversation) {
            throw new Error(
              'This conversation could not be opened.',
            );
          }

          conversationCacheRef.current.set(
            persistedConversation.id,
            persistedConversation,
          );

          if (
            openConversationRequestRef
              .current
            !== requestId
          ) {
            return;
          }

          const persistedMessages =
            normalizePersistedMessages(
              persistedConversation.messages,
            );

          setCurrentConversation(
            persistedConversation,
          );

          setMessages(
            persistedMessages.length
              ? persistedMessages
              : [WELCOME_MESSAGE],
          );

          setInput('');
          setChatError('');
          setLastFailedPrompt('');

          setOpeningConversation(
            false,
          );
        } catch (error) {
          if (
            openConversationRequestRef
              .current
            !== requestId
          ) {
            return;
          }

          setOpeningConversation(
            false,
          );

          if (!cachedConversation) {
            setChatError(
              error.message
              || 'This conversation could not be opened.',
            );
          }
        }
      },
      [
        API_BASE_URL,
        sending,
        userToken,
      ],
    );

  const createConversation =
    useCallback(async () => {
      if (
        !userToken
        || !API_BASE_URL
        || sending
      ) {
        return null;
      }

      setChatError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/my/ai-conversations`,
          {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({}),
          },
        );

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.message
            || 'A new conversation could not be created.',
          );
        }

        const conversation =
          payload?.conversation
          || null;

        if (!conversation) {
          throw new Error(
            'A new conversation could not be created.',
          );
        }

        conversationCacheRef.current.set(
          conversation.id,
          conversation,
        );

        setCurrentConversation(
          conversation,
        );

        setMessages([
          WELCOME_MESSAGE,
        ]);

        setInput('');
        setChatError('');
        setLastFailedPrompt('');
        setChatsVisible(false);

        return conversation;
      } catch (error) {
        setChatError(
          error.message
          || 'A new conversation could not be created.',
        );

        return null;
      }
    }, [
      API_BASE_URL,
      sending,
      userToken,
    ]);

  useEffect(() => {
    fetchCareSnapshot();
  }, [
    fetchCareSnapshot,
  ]);

  useEffect(() => {
    refreshConversationLists();
  }, [
    refreshConversationLists,
  ]);

  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios'
      ? 'keyboardWillShow'
      : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios'
      ? 'keyboardWillHide'
      : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(keyboardShowEvent, (event) => {
      setKeyboardInset(
        Platform.OS === 'ios'
          ? event?.endCoordinates?.height || 0
          : 0,
      );
    });
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const timeout =
      setTimeout(() => {
        scrollRef.current
          ?.scrollToEnd({
            animated: true,
          });
      }, 100);

    return () =>
      clearTimeout(timeout);
  }, [
    messages,
    sending,
    chatError,
  ]);

  const startNewConversation =
    useCallback(() => {
      if (sending) {
        return;
      }

      openConversationRequestRef
        .current += 1;

      setCurrentConversation(null);

      setOpeningConversation(
        false,
      );

      setMessages([
        WELCOME_MESSAGE,
      ]);

      setInput('');
      setChatError('');
      setLastFailedPrompt('');
      setSelectedConversation(null);
      setActiveChatOverlay(null);
      setChatsView('active');
      setChatsVisible(false);
    }, [
      sending,
    ]);

  const oralHealthSummary =
    oralHealth?.summary
    && typeof oralHealth.summary
      === 'object'
      ? oralHealth.summary
      : {};

  const recentLogs =
    Array.isArray(
      oralHealth?.logs,
    )
      ? oralHealth.logs
      : [];

  const contextualEducation =
    Array.isArray(
      oralHealth?.contextualEducation,
    )
      ? oralHealth.contextualEducation
      : [];

  const latestLogDate =
    oralHealthSummary.lastLogDateKey
    || recentLogs[0]?.logDateKey
    || '';

  const recommendationLabel =
    visitInfo?.label
    || (
      careLoading
        ? 'Loading...'
        : 'Insufficient Data'
    );

  const recommendationWindow =
    visitInfo?.windowLabel
    || visitInfo?.recommendedDateLabel
    || '';

  const recommendationReason =
    visitInfo?.recommendationReason
    || (
      visitInfo
        ? 'NgitiFy is using the current System Recommendation.'
        : 'NgitiFy does not currently have enough supported clinic information to create a visit window.'
    );

  const pinnedConversations =
    conversations.filter(
      (conversation) =>
        conversation.isPinned,
    );

  const recentConversations =
    conversations.filter(
      (conversation) =>
        !conversation.isPinned,
    );

  const currentConversationArchived =
    Boolean(
      currentConversation?.isArchived,
    );

  const applyConversationLocally =
    useCallback(
      (conversation) => {
        if (!conversation?.id) {
          return null;
        }

        const cachedConversation =
          conversationCacheRef.current.get(
            conversation.id,
          );

        const mergedConversation = {
          ...cachedConversation,
          ...conversation,
          messages:
            conversation.messages
            || cachedConversation?.messages
            || [],
        };

        conversationCacheRef.current.set(
          mergedConversation.id,
          mergedConversation,
        );

        setCurrentConversation(
          (current) => {
            if (
              current?.id
              !== mergedConversation.id
            ) {
              return current;
            }

            return {
              ...current,
              ...mergedConversation,
              messages:
                mergedConversation.messages
                || current.messages
                || [],
            };
          },
        );

        if (
          mergedConversation.isArchived
        ) {
          setConversations(
            (current) =>
              current.filter(
                (item) =>
                  item.id
                  !== mergedConversation.id,
              ),
          );

          setArchivedConversations(
            (current) => {
              const existingIndex =
                current.findIndex(
                  (item) =>
                    item.id
                    === mergedConversation.id,
                );

              if (
                existingIndex >= 0
              ) {
                const next = [
                  ...current,
                ];

                next[
                  existingIndex
                ] = {
                  ...next[
                    existingIndex
                  ],
                  ...mergedConversation,
                };

                return next;
              }

              return [
                mergedConversation,
                ...current,
              ];
            },
          );
        } else {
          setArchivedConversations(
            (current) =>
              current.filter(
                (item) =>
                  item.id
                  !== mergedConversation.id,
              ),
          );

          setConversations(
            (current) => {
              const existingIndex =
                current.findIndex(
                  (item) =>
                    item.id
                    === mergedConversation.id,
                );

              if (
                existingIndex >= 0
              ) {
                const next = [
                  ...current,
                ];

                next[
                  existingIndex
                ] = {
                  ...next[
                    existingIndex
                  ],
                  ...mergedConversation,
                };

                return next;
              }

              return [
                mergedConversation,
                ...current,
              ];
            },
          );
        }

        return mergedConversation;
      },
      [],
    );

  const sendMessage =
    useCallback(
      async (promptText) => {
        const text = String(
          promptText !== undefined
            ? promptText
            : input,
        ).trim();

        if (
          !text
          || sending
          || !userToken
          || !API_BASE_URL
        ) {
          return;
        }

        let conversation =
          currentConversation;

        if (!conversation?.id) {
          conversation =
            await createConversation();

          if (!conversation?.id) {
            return;
          }
        }

        const optimisticUserMessage = {
          id:
            `user-${Date.now()}`,
          role: 'user',
          content: text,
        };

        setMessages((current) => [
          ...current,
          optimisticUserMessage,
        ]);

        setInput('');
        setSending(true);
        setChatError('');
        setLastFailedPrompt('');

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/my/ai-conversations/${conversation.id}/messages`,
            {
              method: 'POST',
              headers: {
                ...authHeaders,
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                content: text,
              }),
            },
          );

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              getChatErrorMessage(
                response.status,
                payload,
              ),
            );
          }

          const persistedConversation =
            payload?.conversation
            || conversation;

          const persistedMessages =
            normalizePersistedMessages(
              persistedConversation
                ?.messages,
            );

          if (
            persistedMessages.length
          ) {
            setMessages(
              persistedMessages,
            );
          } else {
            const reply = String(
              payload?.reply
              || '',
            ).trim();

            if (!reply) {
              throw new Error(
                'The AI explanation returned an empty response.',
              );
            }

            setMessages((current) => [
              ...current,
              {
                id:
                  `assistant-${Date.now()}`,
                role:
                  'assistant',
                content:
                  reply,
              },
            ]);
          }

          if (
            persistedConversation?.id
          ) {
            conversationCacheRef.current.set(
              persistedConversation.id,
              persistedConversation,
            );
          }

          setCurrentConversation(
            persistedConversation,
          );

          void refreshConversationLists({
            quiet: true,
          });
        } catch (error) {
          setMessages((current) =>
            current.filter(
              (message) =>
                message.id
                !== optimisticUserMessage.id,
            ),
          );

          setChatError(
            error.message
            || 'The AI explanation could not be loaded.',
          );

          setLastFailedPrompt(text);
        } finally {
          setSending(false);
        }
      },
      [
        API_BASE_URL,
        createConversation,
        currentConversation,
        input,
        refreshConversationLists,
        sending,
        userToken,
      ],
    );

  const updateConversation =
    useCallback(
      async (
        conversation,
        changes,
      ) => {
        if (
          !conversation?.id
          || !userToken
          || !API_BASE_URL
        ) {
          return null;
        }

        setConversationsError('');

        const cachedConversation =
          conversationCacheRef.current.get(
            conversation.id,
          );

        const originalConversation = {
          ...cachedConversation,
          ...conversation,
          messages:
            cachedConversation?.messages
            || conversation.messages
            || [],
        };

        const optimisticConversation = {
          ...originalConversation,
          ...changes,
        };

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            'title',
          )
        ) {
          optimisticConversation.titleSource =
            'manual';
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            'isArchived',
          )
        ) {
          optimisticConversation.archivedAt =
            changes.isArchived
              ? new Date()
                .toISOString()
              : null;
        }

        applyConversationLocally(
          optimisticConversation,
        );

        const previousVersion =
          conversationMutationVersionRef
            .current
            .get(
              conversation.id,
            )
          || 0;

        const mutationVersion =
          previousVersion + 1;

        conversationMutationVersionRef
          .current
          .set(
            conversation.id,
            mutationVersion,
          );

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/my/ai-conversations/${conversation.id}`,
            {
              method: 'PATCH',
              headers: {
                ...authHeaders,
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify(changes),
            },
          );

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload?.message
              || 'The conversation could not be updated.',
            );
          }

          const latestVersion =
            conversationMutationVersionRef
              .current
              .get(
                conversation.id,
              );

          const persistedConversation =
            payload?.conversation
            || optimisticConversation;

          if (
            latestVersion
            === mutationVersion
          ) {
            applyConversationLocally(
              persistedConversation,
            );
          }

          void refreshConversationLists({
            quiet: true,
          });

          return persistedConversation;
        } catch (error) {
          const latestVersion =
            conversationMutationVersionRef
              .current
              .get(
                conversation.id,
              );

          if (
            latestVersion
            === mutationVersion
          ) {
            applyConversationLocally(
              originalConversation,
            );

            setConversationsError(
              error.message
              || 'The conversation could not be updated.',
            );
          }

          return null;
        }
      },
      [
        API_BASE_URL,
        applyConversationLocally,
        refreshConversationLists,
        userToken,
      ],
    );

  const requestDeleteConversation =
    useCallback(
      (conversation) => {
        if (
          !conversation?.id
          || managementBusy
        ) {
          return;
        }

        setSelectedConversation(
          conversation,
        );

        setActiveChatOverlay(
          'delete-confirm',
        );
      },
      [
        managementBusy,
      ],
    );

  const confirmDeleteConversation =
    useCallback(
      async () => {
        const conversation =
          selectedConversation;

        if (
          !conversation?.id
          || !userToken
          || !API_BASE_URL
        ) {
          return;
        }

        const cachedConversation =
          conversationCacheRef.current.get(
            conversation.id,
          );

        const originalConversation = {
          ...cachedConversation,
          ...conversation,
          messages:
            cachedConversation?.messages
            || conversation.messages
            || [],
        };

        const deletingCurrentConversation =
          currentConversation?.id
          === conversation.id;

        const previousMessages =
          deletingCurrentConversation
            ? messages
            : null;

        setActiveChatOverlay(
          null,
        );

        setSelectedConversation(
          null,
        );

        setConversationsError('');

        conversationCacheRef.current.delete(
          conversation.id,
        );

        setConversations(
          (current) =>
            current.filter(
              (item) =>
                item.id
                !== conversation.id,
            ),
        );

        setArchivedConversations(
          (current) =>
            current.filter(
              (item) =>
                item.id
                !== conversation.id,
            ),
        );

        if (
          deletingCurrentConversation
        ) {
          openConversationRequestRef
            .current += 1;

          setCurrentConversation(
            null,
          );

          setOpeningConversation(
            false,
          );

          setMessages([
            WELCOME_MESSAGE,
          ]);

          setInput('');
          setChatError('');
          setLastFailedPrompt('');
        }

        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/my/ai-conversations/${conversation.id}`,
              {
                method: 'DELETE',
                headers: authHeaders,
              },
            );

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload?.message
              || 'The conversation could not be deleted.',
            );
          }

          void refreshConversationLists({
            quiet: true,
          });
        } catch (error) {
          conversationCacheRef.current.set(
            originalConversation.id,
            originalConversation,
          );

          if (
            originalConversation.isArchived
          ) {
            setArchivedConversations(
              (current) => [
                originalConversation,
                ...current.filter(
                  (item) =>
                    item.id
                    !== originalConversation.id,
                ),
              ],
            );
          } else {
            setConversations(
              (current) => [
                originalConversation,
                ...current.filter(
                  (item) =>
                    item.id
                    !== originalConversation.id,
                ),
              ],
            );
          }

          if (
            deletingCurrentConversation
          ) {
            setCurrentConversation(
              originalConversation,
            );

            setMessages(
              previousMessages?.length
                ? previousMessages
                : normalizePersistedMessages(
                  originalConversation
                    .messages,
                ),
            );
          }

          setConversationsError(
            error.message
            || 'The conversation could not be deleted.',
          );
        }
      },
      [
        API_BASE_URL,
        currentConversation,
        messages,
        refreshConversationLists,
        selectedConversation,
        userToken,
      ],
    );

  const openConversationMenu = (
    conversation,
  ) => {
    setSelectedConversation(
      conversation,
    );

    setActiveChatOverlay(
      'conversation-menu',
    );
  };

  const beginRename = () => {
    if (!selectedConversation) {
      return;
    }

    setRenameValue(
      selectedConversation.title
      || '',
    );

    setActiveChatOverlay(
      'rename',
    );
  };

  const confirmRename =
    () => {
      const title =
        renameValue.trim();

      const conversation =
        selectedConversation;

      if (
        !title
        || !conversation
      ) {
        return;
      }

      const optimisticConversation = {
        ...conversation,
        title,
        titleSource: 'manual',
      };

      setSelectedConversation(
        optimisticConversation,
      );

      setActiveChatOverlay(
        null,
      );

      void updateConversation(
        conversation,
        {
          title,
        },
      );
    };

  const requestArchiveConversation =
    (
      conversation,
    ) => {
      if (
        !conversation?.id
        || managementBusy
      ) {
        return;
      }

      setSelectedConversation(
        conversation,
      );

      setPendingArchiveState(
        !conversation.isArchived,
      );

      setActiveChatOverlay(
        'archive-confirm',
      );
    };

  const confirmArchiveConversation =
    useCallback(
      () => {
        const conversation =
          selectedConversation;

        if (
          !conversation
          || pendingArchiveState
            === null
        ) {
          return;
        }

        const nextArchived =
          pendingArchiveState;

        const optimisticConversation = {
          ...conversation,
          isArchived:
            nextArchived,
          archivedAt:
            nextArchived
              ? new Date()
                .toISOString()
              : null,
        };

        setSelectedConversation(
          optimisticConversation,
        );

        setPendingArchiveState(
          null,
        );

        setActiveChatOverlay(
          null,
        );

        void updateConversation(
          conversation,
          {
            isArchived:
              nextArchived,
          },
        );
      },
      [
        pendingArchiveState,
        selectedConversation,
        updateConversation,
      ],
    );

  const renderQuickPrompts = () => (
    <View
      style={[
        styles.quickPromptSection,
        messages.length <= 1
          && styles.quickPromptSectionEmpty,
      ]}
    >
      <Text
        style={styles.quickPromptLabel}
        accessibilityRole="header"
      >
        Try asking
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={
          styles.promptContent
        }
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_PROMPTS.map(
          (prompt) => (
            <TouchableOpacity
              key={prompt.id}
              style={styles.promptChip}
              onPress={() =>
                sendMessage(
                  prompt.label,
                )
              }
              disabled={sending}
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel={
                prompt.label
              }
            >
              <Ionicons
                name={prompt.icon}
                size={17}
                color={
                  mobileTheme
                    .colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.promptChipText
                }
              >
                {prompt.label}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>
    </View>
  );

  const renderConversation = () => (
    <>
      {openingConversation ? (
        <View
          style={[
            styles.messageRow,
            styles.messageRowAssistant,
          ]}
        >
          <View
            style={
              styles.messageAvatar
            }
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={
                mobileTheme
                  .colors
                  .primaryDark
              }
            />
          </View>

          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
            ]}
          >
            <View
              style={
                styles.typingRow
              }
            >
              <ActivityIndicator
                size="small"
                color={
                  mobileTheme
                    .colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.typingText
                }
              >
                Loading conversation...
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {messages.map(
        (message) => {
          const isUser =
            message.role === 'user';

          return (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                isUser
                  ? styles.messageRowUser
                  : styles.messageRowAssistant,
              ]}
            >
              {!isUser ? (
                <View
                  style={
                    styles.messageAvatar
                  }
                >
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color={
                      mobileTheme
                        .colors
                        .primaryDark
                    }
                  />
                </View>
              ) : null}

              <View
                style={[
                  styles.messageBubble,
                  isUser
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isUser
                      && styles.userMessageText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            </View>
          );
        },
      )}

      {sending ? (
        <View
          style={[
            styles.messageRow,
            styles.messageRowAssistant,
          ]}
        >
          <View
            style={styles.messageAvatar}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={
                mobileTheme
                  .colors
                  .primaryDark
              }
            />
          </View>

          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
            ]}
          >
            <View
              style={styles.typingRow}
            >
              <ActivityIndicator
                size="small"
                color={
                  mobileTheme
                    .colors
                    .primaryDark
                }
              />

              <Text
                style={styles.typingText}
              >
                Preparing an explanation...
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {chatError ? (
        <View
          style={styles.chatErrorCard}
          accessibilityRole="alert"
        >
          <Ionicons
            name="warning-outline"
            size={20}
            color={
              mobileTheme
                .colors
                .primaryDark
            }
          />

          <View
            style={
              styles.chatErrorContent
            }
          >
            <Text
              style={
                styles.chatErrorTitle
              }
            >
              AI explanation unavailable
            </Text>

            <Text
              style={
                styles.chatErrorText
              }
            >
              {chatError}
            </Text>

            {lastFailedPrompt ? (
              <TouchableOpacity
                style={
                  styles.retryButton
                }
                onPress={() =>
                  sendMessage(
                    lastFailedPrompt,
                  )
                }
                disabled={sending}
                activeOpacity={0.84}
                accessibilityRole="button"
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={
                    mobileTheme
                      .colors
                      .primaryDark
                  }
                />

                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Retry
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );

  const renderConversationListItem = (
    conversation,
  ) => {
    const selected =
      currentConversation?.id
      === conversation.id;

    return (
      <View
        key={conversation.id}
        style={[
          styles.conversationListItem,
          selected
            && styles.conversationListItemSelected,
        ]}
      >
        <TouchableOpacity
          style={
            styles.conversationListMain
          }
          onPress={() =>
            openConversation(
              conversation,
            )
          }
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={
            `Open ${conversation.title || 'conversation'}`
          }
        >
          {conversation.isPinned ? (
            <Ionicons
              name="pin"
              size={15}
              color={
                mobileTheme
                  .colors
                  .primaryDark
              }
            />
          ) : (
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={
                mobileTheme
                  .colors
                  .textMuted
              }
            />
          )}

          <Text
            numberOfLines={2}
            style={
              styles.conversationListTitle
            }
          >
            {conversation.title
            || 'New conversation'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.conversationMenuButton
          }
          onPress={() =>
            openConversationMenu(
              conversation,
            )
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            `Conversation options for ${conversation.title || 'conversation'}`
          }
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={
              mobileTheme
                .colors
                .textMuted
            }
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderChatsModal = () => {
    const showingArchived =
      chatsView === 'archived';

    return (
      <View
        style={
          styles.fullScreenOverlay
        }
      >
        <TouchableOpacity
          style={styles.historyBackdrop}
          onPress={() => setChatsVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close chat history"
        />
        <View
          style={styles.modalScreen}
        >
          <View
            style={styles.modalHeader}
          >
            <TouchableOpacity
              style={
                styles.modalHeaderButton
              }
              onPress={() => {
                if (showingArchived) {
                  setChatsView('active');
                  return;
                }

                setActiveChatOverlay(null);
                setChatsVisible(false);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                showingArchived
                  ? 'Back to conversations'
                  : 'Close chats'
              }
            >
              <Ionicons
                name={
                  showingArchived
                    ? 'chevron-back'
                    : 'close'
                }
                size={24}
                color={
                  mobileTheme
                    .colors
                    .text
                }
              />
            </TouchableOpacity>

            <Text
              style={
                styles.modalHeaderTitle
              }
            >
              {showingArchived
                ? 'Archived'
                : 'Chats'}
            </Text>

            {showingArchived ? (
              <View
                style={
                  styles.modalHeaderButton
                }
              />
            ) : (
              <TouchableOpacity
                style={
                  styles.modalHeaderButton
                }
                onPress={
                  startNewConversation
                }
                disabled={sending}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="New conversation"
              >
                <Ionicons
                  name="create-outline"
                  size={23}
                  color={
                    mobileTheme
                      .colors
                      .primaryDark
                  }
                />
              </TouchableOpacity>
            )}
          </View>

          {showingArchived ? (
            <ScrollView
              style={
                styles.archivedBody
              }
              contentContainerStyle={
                styles.archivedContent
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {archivedConversations.length
                ? archivedConversations.map(
                  renderConversationListItem,
                )
                : (
                  <Text
                    style={
                      styles.emptyListText
                    }
                  >
                    No archived conversations.
                  </Text>
                )}
            </ScrollView>
          ) : (
            <View
              style={styles.chatsBody}
            >
              <TouchableOpacity
                style={
                  styles.newConversationButton
                }
                onPress={
                  startNewConversation
                }
                disabled={sending}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="New conversation"
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.newConversationText
                  }
                >
                  New conversation
                </Text>
              </TouchableOpacity>

              {conversationsLoading ? (
                <View
                  style={
                    styles.centerState
                  }
                >
                  <ActivityIndicator
                    color={
                      mobileTheme
                        .colors
                        .primaryDark
                    }
                  />

                  <Text
                    style={
                      styles.centerStateText
                    }
                  >
                    Loading saved conversations...
                  </Text>
                </View>
              ) : null}

              {conversationsError ? (
                <View
                  style={
                    styles.listErrorBox
                  }
                >
                  <Text
                    style={
                      styles.listErrorText
                    }
                  >
                    {conversationsError}
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.smallActionButton
                    }
                    onPress={() =>
                      refreshConversationLists()
                    }
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading conversations"
                  >
                    <Text
                      style={
                        styles.smallActionText
                      }
                    >
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!conversationsLoading ? (
                <ScrollView
                  style={
                    styles.conversationListScroll
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  {pinnedConversations.length
                    ? (
                      <>
                        <Text
                          style={
                            styles.listSectionLabel
                          }
                        >
                          PINNED
                        </Text>

                        {pinnedConversations.map(
                          renderConversationListItem,
                        )}
                      </>
                    )
                    : null}

                  <Text
                    style={[
                      styles.listSectionLabel,
                      pinnedConversations.length
                        ? styles.listSectionSpacing
                        : null,
                    ]}
                  >
                    RECENT
                  </Text>

                  {recentConversations.length
                    ? recentConversations.map(
                      renderConversationListItem,
                    )
                    : (
                      <Text
                        style={
                          styles.emptyListText
                        }
                      >
                        No saved conversations yet.
                      </Text>
                    )}

                  <TouchableOpacity
                    style={
                      styles.archivedLink
                    }
                    onPress={() =>
                      setChatsView(
                        'archived',
                      )
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open archived conversations"
                  >
                    <Ionicons
                      name="archive-outline"
                      size={18}
                      color={
                        mobileTheme
                          .colors
                          .textMuted
                      }
                    />

                    <Text
                      style={
                        styles.archivedLinkText
                      }
                    >
                      Archived conversations
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        mobileTheme
                          .colors
                          .textSoft
                      }
                    />
                  </TouchableOpacity>
                </ScrollView>
              ) : null}
            </View>
          )}

          {activeChatOverlay
            === 'conversation-menu'
            ? renderConversationMenuOverlay()
            : null}

          {activeChatOverlay
            === 'rename'
            ? renderRenameOverlay()
            : null}

          {activeChatOverlay
            === 'delete-confirm'
            ? renderDeleteConfirmOverlay()
            : null}

          {activeChatOverlay
            === 'archive-confirm'
            ? renderArchiveConfirmOverlay()
            : null}
        </View>
      </View>
    );
  };

  const renderInfoOverlay = () => (
    <View
      style={
        styles.fullScreenOverlay
      }
    >
      <View
        style={styles.sheetBackdrop}
      >
        <View
          style={styles.infoSheet}
        >
          <View
            style={
              styles.sheetHandle
            }
          />

          <View
            style={
              styles.infoHeader
            }
          >
            <View>
              <Text
                style={
                  styles.infoEyebrow
                }
              >
                NGITIBOT
              </Text>

              <Text
                style={
                  styles.infoTitle
                }
              >
                About this chat
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.sheetCloseButton
              }
              onPress={() =>
                setInfoVisible(false)
              }
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close AI information"
            >
              <Ionicons
                name="close"
                size={22}
                color={
                  mobileTheme
                    .colors
                    .text
                }
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
          >
            <Text
              style={
                styles.infoSectionTitle
              }
            >
              Ask about your NgitiFy care
            </Text>

            <Text
              style={
                styles.infoBody
              }
            >
              NgitiBot can explain existing NgitiFy information such as appointments, your System Recommendation, Oral Health Management records, and approved Dental Health Education.
            </Text>

            <View
              style={
                styles.infoDivider
              }
            />

            <View
              style={
                styles.infoSectionHeader
              }
            >
              <Text
                style={
                  styles.infoSectionTitle
                }
              >
                What NgitiFy already knows
              </Text>

              <TouchableOpacity
                style={
                  styles.infoRefreshButton
                }
                onPress={
                  fetchCareSnapshot
                }
                disabled={careLoading}
                activeOpacity={0.8}
              >
                {careLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      mobileTheme
                        .colors
                        .primaryDark
                    }
                  />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={
                      mobileTheme
                        .colors
                        .primaryDark
                    }
                  />
                )}
              </TouchableOpacity>
            </View>

            {careError ? (
              <Text
                style={
                  styles.infoErrorText
                }
              >
                {careError}
              </Text>
            ) : null}

            <View
              style={
                styles.infoContextBlock
              }
            >
              <View
                style={
                  styles.infoContextTitleRow
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={
                    mobileTheme
                      .colors
                      .primaryDark
                  }
                />

                <View
                  style={
                    styles.infoContextTitleText
                  }
                >
                  <Text
                    style={
                      styles.infoContextEyebrow
                    }
                  >
                    SYSTEM RECOMMENDATION
                  </Text>

                  <Text
                    style={
                      styles.infoContextTitle
                    }
                  >
                    Recommended Visit Window
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.infoStrongText
                }
              >
                {recommendationLabel}
              </Text>

              {recommendationWindow ? (
                <Text
                  style={
                    styles.infoBody
                  }
                >
                  {recommendationWindow}
                </Text>
              ) : null}

              <Text
                style={
                  styles.infoBody
                }
              >
                {recommendationReason}
              </Text>

              {visitInfo
                ?.contactClinicSooner ? (
                  <Text
                    style={
                      styles.infoNotice
                    }
                  >
                    {visitInfo
                      .contactClinicReason
                    || 'NgitiFy suggests contacting the clinic sooner.'}
                  </Text>
                )
                : null}

              <Text
                style={
                  styles.infoAuthorityText
                }
              >
                This System Recommendation comes from NgitiFy&apos;s deterministic backend rules. AI may explain it but may not calculate, postpone, replace, or override it.
              </Text>
            </View>

            <View
              style={
                styles.infoDivider
              }
            />

            <View
              style={
                styles.infoContextBlock
              }
            >
              <View
                style={
                  styles.infoContextTitleRow
                }
              >
                <MaterialCommunityIcons
                  name="tooth-outline"
                  size={21}
                  color={
                    mobileTheme
                      .colors
                      .primaryDark
                  }
                />

                <View
                  style={
                    styles.infoContextTitleText
                  }
                >
                  <Text
                    style={
                      styles.infoContextEyebrow
                    }
                  >
                    ORAL HEALTH MANAGEMENT
                  </Text>

                  <Text
                    style={
                      styles.infoContextTitle
                    }
                  >
                    Relevant recorded context
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.infoBody
                }
              >
                {latestLogDate
                  ? `Latest saved log: ${formatDateKey(latestLogDate)}.`
                  : 'No recent Daily Oral Health Log is available yet.'}
              </Text>

              <Text
                style={
                  styles.infoBody
                }
              >
                Recent logs: {oralHealthSummary.recentLogCount ?? recentLogs.length}
              </Text>

              <Text
                style={
                  styles.infoAuthorityText
                }
              >
                Oral Health Management entries are recorded context only. They help AI explain existing information and do not become a diagnosis.
              </Text>
            </View>

            <View
              style={
                styles.infoDivider
              }
            />

            <View
              style={
                styles.infoContextBlock
              }
            >
              <View
                style={
                  styles.infoContextTitleRow
                }
              >
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={
                    mobileTheme
                      .colors
                      .primaryDark
                  }
                />

                <View
                  style={
                    styles.infoContextTitleText
                  }
                >
                  <Text
                    style={
                      styles.infoContextEyebrow
                    }
                  >
                    DENTAL HEALTH EDUCATION
                  </Text>

                  <Text
                    style={
                      styles.infoContextTitle
                    }
                  >
                    Relevant approved education
                  </Text>
                </View>
              </View>

              {contextualEducation.length
                ? contextualEducation
                  .slice(0, 3)
                  .map(
                    (article) => (
                      <View
                        key={
                          article.id
                        }
                        style={
                          styles.infoEducationItem
                        }
                      >
                        <Text
                          style={
                            styles.infoEducationCategory
                          }
                        >
                          {article.category
                          || 'Dental Health Education'}
                        </Text>

                        <Text
                          style={
                            styles.infoEducationTitle
                          }
                        >
                          {article.title}
                        </Text>
                      </View>
                    ),
                  )
                : (
                  <Text
                    style={
                      styles.infoBody
                    }
                  >
                    No contextual Dental Health Education topics are currently matched to your recent logs.
                  </Text>
                )}

              <Text
                style={
                  styles.infoAuthorityText
                }
              >
                Dental Health Education remains approved educational content. AI must not provide a diagnosis.
              </Text>
            </View>

            <View
              style={
                styles.infoSafetyBox
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={
                  mobileTheme
                    .colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.infoSafetyText
                }
              >
                NgitiBot is educational and explanatory. It does not diagnose conditions or replace professional dental care. Contact the clinic if symptoms persist, worsen, or concern you.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );

  const renderConversationMenuOverlay =
    () => (
      <View
        style={
          styles.actionBackdrop
        }
      >
        <TouchableOpacity
          style={
            styles.actionBackdropTouch
          }
          activeOpacity={1}
          onPress={() =>
            setActiveChatOverlay(
              null,
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Close conversation options"
        />

        <View
          style={
            styles.actionSheet
          }
        >
          <Text
            numberOfLines={2}
            style={
              styles.actionSheetTitle
            }
          >
            {selectedConversation
              ?.title
            || 'Conversation'}
          </Text>

          <TouchableOpacity
            style={
              styles.actionRow
            }
            onPress={
              beginRename
            }
            disabled={
              managementBusy
            }
          >
            <Ionicons
              name="pencil-outline"
              size={20}
              color={
                mobileTheme
                  .colors
                  .text
              }
            />

            <Text
              style={
                styles.actionText
              }
            >
              Rename
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.actionRow
            }
            onPress={() => {
              const conversation =
                selectedConversation;

              if (!conversation) {
                return;
              }

              const nextPinned =
                !conversation.isPinned;

              setSelectedConversation(
                {
                  ...conversation,
                  isPinned:
                    nextPinned,
                },
              );

              setActiveChatOverlay(
                null,
              );

              void updateConversation(
                conversation,
                {
                  isPinned:
                    nextPinned,
                },
              );
            }}
            disabled={
              managementBusy
            }
          >
            <Ionicons
              name={
                selectedConversation
                  ?.isPinned
                  ? 'pin-outline'
                  : 'pin'
              }
              size={20}
              color={
                mobileTheme
                  .colors
                  .text
              }
            />

            <Text
              style={
                styles.actionText
              }
            >
              {selectedConversation
                ?.isPinned
                ? 'Unpin'
                : 'Pin'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.actionRow
            }
            onPress={() =>
              requestArchiveConversation(
                selectedConversation,
              )
            }
            disabled={
              managementBusy
            }
          >
            <Ionicons
              name={
                selectedConversation
                  ?.isArchived
                  ? 'arrow-undo-outline'
                  : 'archive-outline'
              }
              size={20}
              color={
                mobileTheme
                  .colors
                  .text
              }
            />

            <Text
              style={
                styles.actionText
              }
            >
              {selectedConversation
                ?.isArchived
                ? 'Unarchive'
                : 'Archive'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionRow,
              styles.actionRowDanger,
            ]}
            onPress={() =>
              requestDeleteConversation(
                selectedConversation,
              )
            }
            disabled={
              managementBusy
            }
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color="#b42318"
            />

            <Text
              style={
                styles.actionDangerText
              }
            >
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  const renderRenameOverlay = () => (
    <View
      style={
        styles.renameBackdrop
      }
    >
      <View
        style={
          styles.renameDialog
        }
      >
        <Text
          style={
            styles.renameTitle
          }
        >
          Rename conversation
        </Text>

        <TextInput
          style={
            styles.renameInput
          }
          value={renameValue}
          onChangeText={
            setRenameValue
          }
          autoFocus
          maxLength={100}
          placeholder="Conversation title"
          placeholderTextColor={
            mobileTheme
              .colors
              .textSoft
          }
          accessibilityLabel="Conversation title"
        />

        <View
          style={
            styles.renameActions
          }
        >
          <TouchableOpacity
            style={
              styles.renameCancelButton
            }
            onPress={() =>
              setActiveChatOverlay(
                null,
              )
            }
            disabled={
              managementBusy
            }
          >
            <Text
              style={
                styles.renameCancelText
              }
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.renameSaveButton,
              (
                !renameValue.trim()
                || managementBusy
              )
                && styles.disabledButton,
            ]}
            onPress={
              confirmRename
            }
            disabled={
              !renameValue.trim()
              || managementBusy
            }
          >
            {managementBusy ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.renameSaveText
                }
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderDeleteConfirmOverlay =
    () => (
      <View
        style={
          styles.confirmBackdrop
        }
      >
        <View
          style={
            styles.confirmDialog
          }
        >
          <View
            style={
              styles.confirmIconDanger
            }
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color="#b42318"
            />
          </View>

          <Text
            style={
              styles.confirmTitle
            }
          >
            Delete conversation?
          </Text>

          <Text
            style={
              styles.confirmText
            }
          >
            This permanently deletes this saved conversation and its message history.
          </Text>

          <View
            style={
              styles.confirmActions
            }
          >
            <TouchableOpacity
              style={
                styles.confirmCancelButton
              }
              onPress={() =>
                setActiveChatOverlay(
                  null,
                )
              }
              disabled={
                managementBusy
              }
            >
              <Text
                style={
                  styles.confirmCancelText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmDeleteButton,
                managementBusy
                  && styles.disabledButton,
              ]}
              onPress={
                confirmDeleteConversation
              }
              disabled={
                managementBusy
              }
            >
              {managementBusy ? (
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />
              ) : (
                <Text
                  style={
                    styles.confirmDeleteText
                  }
                >
                  Delete
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );

  const renderArchiveConfirmOverlay =
    () => {
      const archiving =
        pendingArchiveState === true;

      return (
        <View
          style={
            styles.confirmBackdrop
          }
        >
          <View
            style={
              styles.confirmDialog
            }
          >
            <View
              style={
                styles.confirmIconPrimary
              }
            >
              <Ionicons
                name={
                  archiving
                    ? 'archive-outline'
                    : 'arrow-undo-outline'
                }
                size={24}
                color={
                  mobileTheme
                    .colors
                    .primaryDark
                }
              />
            </View>

            <Text
              style={
                styles.confirmTitle
              }
            >
              {archiving
                ? 'Archive conversation?'
                : 'Unarchive conversation?'}
            </Text>

            <Text
              style={
                styles.confirmText
              }
            >
              {archiving
                ? 'This conversation will move to Archived and become read-only.'
                : 'This conversation will return to your active chats and you can continue messaging.'}
            </Text>

            <View
              style={
                styles.confirmActions
              }
            >
              <TouchableOpacity
                style={
                  styles.confirmCancelButton
                }
                onPress={() => {
                  setPendingArchiveState(
                    null,
                  );

                  setActiveChatOverlay(
                    null,
                  );
                }}
                disabled={
                  managementBusy
                }
              >
                <Text
                  style={
                    styles.confirmCancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.archiveConfirmButton,
                  managementBusy
                    && styles.disabledButton,
                ]}
                onPress={
                  confirmArchiveConversation
                }
                disabled={
                  managementBusy
                }
              >
                {managementBusy ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.archiveConfirmText
                    }
                  >
                    {archiving
                      ? 'Archive'
                      : 'Unarchive'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'android'
          ? 'height'
          : undefined
      }
    >
      <View
        style={[
          styles.header,
          embedded && styles.embeddedHeader,
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            setActiveChatOverlay(null);
            setChatsView('active');
            setChatsVisible(true);
          }}
          style={
            styles.headerSideButton
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open saved conversations"
        >
          <Ionicons
            name="menu-outline"
            size={23}
            color={
              mobileTheme
                .colors
                .primary
            }
          />

          <Text
            style={
              styles.headerSideText
            }
          >
            Chats
          </Text>
        </TouchableOpacity>

        <View
          style={
            styles.headerCenter
          }
        >
          <Text
            numberOfLines={1}
            style={
              styles.headerTitle
            }
          >
            {currentConversation
              ?.title
              || 'NgitiBot'}
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            NgitiBot
          </Text>
        </View>

        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => {
            setActiveChatOverlay(null);
            setChatsVisible(false);
            if (onClose) onClose();
            else navigation?.goBack?.();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close AI chat"
        >
          <Ionicons
            name="close"
            size={25}
            color={
              mobileTheme
                .colors
                .primaryDark
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {renderConversation()}
      </ScrollView>

      {currentConversationArchived ? (
        <View
          style={
            styles.archivedChatNotice
          }
        >
          <Text
            style={
              styles.archivedChatNoticeText
            }
          >
            This conversation is archived. Unarchive it to continue chatting.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.chatDock,
            keyboardInset > 0 && {
              marginBottom: keyboardInset,
            },
          ]}
        >
          {renderQuickPrompts()}

          <View
            style={styles.composer}
          >
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message NgitiBot..."
              placeholderTextColor={
                mobileTheme
                  .colors
                  .textSoft
              }
              multiline
              maxLength={1500}
              editable={!sending}
              returnKeyType="default"
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current
                    ?.scrollToEnd({
                      animated: true,
                    });
                }, 100);
              }}
              accessibilityLabel="Message NgitiBot"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (
                  sending
                  || !input.trim()
                )
                  && styles.sendButtonDisabled,
              ]}
              onPress={() =>
                sendMessage()
              }
              disabled={
                sending
                || !input.trim()
              }
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {sending ? (
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />
              ) : (
                <Ionicons
                  name="send"
                  size={19}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {chatsVisible
        ? renderChatsModal()
        : null}

      {infoVisible
        ? renderInfoOverlay()
        : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      mobileTheme.colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingTop: 18,
    paddingBottom: 22,
  },

  header: {
    minHeight: 76,
    paddingTop:
      mobilePageTopInset,
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      mobileTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },

  headerSideButton: {
    width: 78,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerSideText: {
    marginLeft: 5,
    color:
      mobileTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  headerTitle: {
    maxWidth: '100%',
    color:
      mobileTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },

  headerSubtitle: {
    marginTop: 2,
    color:
      mobileTheme.colors.textSoft,
    fontSize: 9,
    fontWeight: '600',
  },

  infoButton: {
    width: 78,
    minHeight: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 13,
  },

  messageRowUser: {
    justifyContent: 'flex-end',
  },

  messageRowAssistant: {
    justifyContent: 'flex-start',
  },

  messageAvatar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    marginRight: 7,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },

  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  assistantBubble: {
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surface,
    ...mobileTheme.shadows.soft,
  },

  userBubble: {
    borderRadius: 17,
    borderBottomRightRadius: 5,
    backgroundColor:
      mobileTheme.colors.primary,
  },

  messageText: {
    color:
      mobileTheme.colors.text,
    fontSize: 13,
    lineHeight: 20,
  },

  userMessageText: {
    color: '#ffffff',
  },

  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  typingText: {
    marginLeft: 8,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
  },

  chatErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
    padding: 13,
    borderRadius:
      mobileTheme.radii.md,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  chatErrorContent: {
    flex: 1,
    marginLeft: 9,
  },

  chatErrorTitle: {
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  chatErrorText: {
    marginTop: 3,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },

  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius:
      mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  retryButtonText: {
    marginLeft: 5,
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  chatDock: {
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  quickPromptSection: {
    paddingTop: 8,
    paddingBottom: 7,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  quickPromptSectionEmpty: {
    paddingTop: 12,
  },

  quickPromptLabel: {
    paddingHorizontal:
      mobileTheme.spacing.md,
    marginBottom: 7,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },

  promptContent: {
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingBottom: 2,
  },

  promptChip: {
    maxWidth: 210,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius:
      mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surfaceAlt,
  },

  promptChipText: {
    flexShrink: 1,
    marginLeft: 7,
    color:
      mobileTheme.colors.text,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingTop: 3,
    paddingBottom: 12,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius:
      mobileTheme.radii.md,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surfaceAlt,
    color:
      mobileTheme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: 'top',
  },

  sendButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 9,
    borderRadius: 24,
    backgroundColor:
      mobileTheme.colors.primary,
    ...mobileTheme.shadows.soft,
  },

  sendButtonDisabled: {
    opacity: 0.45,
  },

  modalScreen: {
    flex: 1,
    width: '82%',
    backgroundColor:
      mobileTheme.colors.background,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },

  embeddedHeader: {
    minHeight: 62,
    paddingTop: 10,
  },

  modalHeader: {
    minHeight: 76,
    paddingTop:
      mobilePageTopInset,
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  modalHeaderButton: {
    width: 48,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color:
      mobileTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },

  chatsBody: {
    flex: 1,
    padding:
      mobileTheme.spacing.md,
  },

  newConversationButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.primary,
  },

  newConversationText: {
    marginLeft: 7,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  conversationListScroll: {
    flex: 1,
    marginTop: 18,
  },

  listSectionLabel: {
    marginBottom: 7,
    color:
      mobileTheme.colors.textSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  listSectionSpacing: {
    marginTop: 18,
  },

  conversationListItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius:
      mobileTheme.radii.md,
  },

  conversationListItemSelected: {
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },

  conversationListMain: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
  },

  conversationListTitle: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },

  conversationMenuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  archivedLink: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 11,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
  },

  archivedLinkText: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  archivedBody: {
    flex: 1,
  },

  archivedContent: {
    padding:
      mobileTheme.spacing.md,
  },

  archivedChatNotice: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal:
      mobileTheme.spacing.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  archivedChatNoticeText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyListText: {
    paddingVertical: 18,
    color:
      mobileTheme.colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },

  centerState: {
    alignItems: 'center',
    paddingVertical: 28,
  },

  centerStateText: {
    marginTop: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
  },

  listErrorBox: {
    marginTop: 16,
    padding: 13,
    borderRadius:
      mobileTheme.radii.md,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  listErrorText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  smallActionButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius:
      mobileTheme.radii.pill,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },

  smallActionText: {
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(15, 23, 42, 0.32)',
  },

  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },

  historyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },

  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding:
      mobileTheme.spacing.lg,
    backgroundColor:
      'rgba(15, 23, 42, 0.42)',
  },

  confirmDialog: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius:
      mobileTheme.radii.lg,
    backgroundColor:
      mobileTheme.colors.surface,
    ...mobileTheme.shadows.soft,
  },

  confirmIconDanger: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor:
      '#fff1f0',
  },

  confirmIconPrimary: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },

  confirmTitle: {
    marginTop: 14,
    color:
      mobileTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  confirmText: {
    marginTop: 7,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
  },

  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },

  confirmCancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  confirmCancelText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  confirmDeleteButton: {
    minWidth: 82,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 16,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      '#b42318',
  },

  confirmDeleteText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  archiveConfirmButton: {
    minWidth: 92,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 16,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.primary,
  },

  archiveConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  infoSheet: {
    maxHeight: '88%',
    minHeight: '64%',
    paddingTop: 9,
    paddingHorizontal:
      mobileTheme.spacing.lg,
    paddingBottom: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor:
      mobileTheme.colors.borderStrong,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  infoEyebrow: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  infoTitle: {
    marginTop: 3,
    color:
      mobileTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },

  sheetCloseButton: {
    width: 42,
    height: 42,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoSectionTitle: {
    flex: 1,
    color:
      mobileTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  infoRefreshButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoBody: {
    marginTop: 7,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
  },

  infoDivider: {
    height: 1,
    marginVertical: 17,
    backgroundColor:
      mobileTheme.colors.border,
  },

  infoContextBlock: {
    paddingVertical: 2,
  },

  infoContextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoContextTitleText: {
    flex: 1,
    marginLeft: 9,
  },

  infoContextEyebrow: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  infoContextTitle: {
    marginTop: 2,
    color:
      mobileTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  infoStrongText: {
    marginTop: 11,
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },

  infoNotice: {
    marginTop: 10,
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },

  infoAuthorityText: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
  },

  infoEducationItem: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },

  infoEducationCategory: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  infoEducationTitle: {
    marginTop: 3,
    color:
      mobileTheme.colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  infoSafetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    padding: 13,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.backgroundMuted,
  },

  infoSafetyText: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
  },

  infoErrorText: {
    marginTop: 8,
    color: '#b42318',
    fontSize: 11,
    lineHeight: 17,
  },

  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(15, 23, 42, 0.32)',
  },

  actionBackdropTouch: {
    flex: 1,
  },

  actionSheet: {
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  actionSheetTitle: {
    marginBottom: 12,
    color:
      mobileTheme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },

  actionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },

  actionRowDanger: {
    borderBottomWidth: 0,
  },

  actionText: {
    marginLeft: 12,
    color:
      mobileTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },

  actionDangerText: {
    marginLeft: 12,
    color: '#b42318',
    fontSize: 13,
    fontWeight: '700',
  },

  renameBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding:
      mobileTheme.spacing.lg,
    backgroundColor:
      'rgba(15, 23, 42, 0.38)',
  },

  renameDialog: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    borderRadius:
      mobileTheme.radii.lg,
    backgroundColor:
      mobileTheme.colors.surface,
    ...mobileTheme.shadows.card,
  },

  renameTitle: {
    color:
      mobileTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },

  renameInput: {
    minHeight: 48,
    marginTop: 15,
    paddingHorizontal: 13,
    borderRadius:
      mobileTheme.radii.md,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.surfaceAlt,
    color:
      mobileTheme.colors.text,
    fontSize: 13,
  },

  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },

  renameCancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },

  renameCancelText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  renameSaveButton: {
    minWidth: 74,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
    paddingHorizontal: 15,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.primary,
  },

  renameSaveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.5,
  },
});
