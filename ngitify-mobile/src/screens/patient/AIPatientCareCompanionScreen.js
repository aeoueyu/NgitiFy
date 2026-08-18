import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
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
import BackIcon from '../../assets/icons/Back.svg';
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
    id: 'education',
    icon: 'book-outline',
    label: 'Give me Dental Health Education related to my recent log',
  },
  {
    id: 'appointment',
    icon: 'time-outline',
    label: 'Help me understand my upcoming appointment',
  },
  {
    id: 'home-care',
    icon: 'sparkles-outline',
    label: 'Give me brushing and flossing guidance',
  },
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hello! I can explain your existing NgitiFy care information, Oral Health Management records, Dental Health Education, appointments, and System Recommendation. I provide educational explanations and do not diagnose conditions or create my own medical recommendations.',
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

const getChatErrorMessage = (status, payload) => {
  if (status === 429) {
    return 'The AI request limit has been reached for now. Your System Recommendation and other core NgitiFy features are still available.';
  }

  if (status === 503) {
    return 'The AI explanation service is temporarily unavailable. Your System Recommendation, Oral Health Management, and Dental Health Education are still available.';
  }

  return (
    payload?.message
    || 'The AI explanation could not be loaded. Please try again.'
  );
};

export default function AiPatientCareCompanionScreen({
  navigation,
}) {
  const {
    userToken,
    API_BASE_URL,
  } = useContext(AuthContext);

  const [visitInfo, setVisitInfo] = useState(null);
  const [oralHealth, setOralHealth] = useState(null);
  const [careLoading, setCareLoading] = useState(true);
  const [careError, setCareError] = useState('');

  const [messages, setMessages] = useState([
    WELCOME_MESSAGE,
  ]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [
    lastFailedPrompt,
    setLastFailedPrompt,
  ] = useState('');

  const scrollRef = useRef(null);

  const authHeaders = {
    Authorization: `Bearer ${userToken}`,
  };

  const fetchCareSnapshot = useCallback(async () => {
    if (!userToken || !API_BASE_URL) {
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
        predictionPayload?.prediction || null,
      );

      setOralHealth(
        oralHealthPayload
        && typeof oralHealthPayload === 'object'
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

  useEffect(() => {
    fetchCareSnapshot();
  }, [fetchCareSnapshot]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [
    messages,
    sending,
    chatError,
  ]);

  const oralHealthSummary =
    oralHealth?.summary
    && typeof oralHealth.summary === 'object'
      ? oralHealth.summary
      : {};

  const recentLogs =
    Array.isArray(oralHealth?.logs)
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

  const sendMessage = useCallback(
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

      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };

      const previousMessages = messages
        .filter(
          (message) =>
            message.id !== 'welcome'
            && message.content,
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const requestMessages = [
        ...previousMessages,
        {
          role: 'user',
          content: text,
        },
      ];

      setMessages((current) => [
        ...current,
        userMessage,
      ]);

      setInput('');
      setSending(true);
      setChatError('');
      setLastFailedPrompt('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/ai/chat`,
          {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: requestMessages,
              assistantContext: {
                clientUiState: {
                  source: 'patient-mobile',
                  currentModule:
                    'Patient AI Assistant',
                  requestedAt:
                    new Date().toISOString(),
                },
              },
            }),
          },
        );

        const payload = await response
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

        const reply = String(
          payload?.reply || '',
        ).trim();

        if (!reply) {
          throw new Error(
            'The AI explanation returned an empty response.',
          );
        }

        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: reply,
          },
        ]);
      } catch (error) {
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
      input,
      messages,
      sending,
      userToken,
    ],
  );

  const clearConversation = () => {
    if (sending) return;

    setMessages([
      WELCOME_MESSAGE,
    ]);

    setInput('');
    setChatError('');
    setLastFailedPrompt('');
  };

  const renderCareContext = () => (
    <View style={styles.contextSection}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionEyebrow}>
            Care context used for explanations
          </Text>

          <Text style={styles.sectionTitle}>
            What NgitiFy already knows
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchCareSnapshot}
          disabled={careLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Refresh care context"
        >
          {careLoading ? (
            <ActivityIndicator
              size="small"
              color={mobileTheme.colors.primaryDark}
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={19}
              color={mobileTheme.colors.primaryDark}
            />
          )}
        </TouchableOpacity>
      </View>

      {careError ? (
        <View style={styles.careErrorCard}>
          <Ionicons
            name="warning-outline"
            size={21}
            color={mobileTheme.colors.primaryDark}
          />

          <Text style={styles.careErrorText}>
            {careError}
          </Text>
        </View>
      ) : null}

      <View style={styles.contextCard}>
        <View style={styles.contextCardHeader}>
          <View style={styles.contextIcon}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={mobileTheme.colors.primaryDark}
            />
          </View>

          <View style={styles.contextHeaderText}>
            <Text style={styles.contextEyebrow}>
              SYSTEM RECOMMENDATION
            </Text>

            <Text style={styles.contextTitle}>
              Recommended Visit Window
            </Text>
          </View>
        </View>

        {careLoading ? (
          <View style={styles.contextLoadingRow}>
            <ActivityIndicator
              size="small"
              color={mobileTheme.colors.primaryDark}
            />

            <Text style={styles.contextLoadingText}>
              Loading recommendation...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {recommendationLabel}
              </Text>
            </View>

            {recommendationWindow ? (
              <Text style={styles.recommendationWindow}>
                {recommendationWindow}
              </Text>
            ) : null}

            <Text style={styles.contextBody}>
              {recommendationReason}
            </Text>

            {visitInfo?.contactClinicSooner ? (
              <View style={styles.contactNotice}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={mobileTheme.colors.primaryDark}
                />

                <View style={styles.contactNoticeText}>
                  <Text style={styles.contactNoticeTitle}>
                    Contact clinic guidance
                  </Text>

                  <Text style={styles.contactNoticeBody}>
                    {visitInfo.contactClinicReason
                    || 'The deterministic NgitiFy recommendation suggests contacting the clinic sooner.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.authorityBox}>
          <Text style={styles.authorityTitle}>
            System Recommendation
          </Text>

          <Text style={styles.authorityText}>
            This recommendation comes from NgitiFy&apos;s deterministic backend rules. AI may explain it but does not calculate, postpone, or override it.
          </Text>
        </View>
      </View>

      <View style={styles.contextCard}>
        <View style={styles.contextCardHeader}>
          <View style={styles.contextIcon}>
            <MaterialCommunityIcons
              name="tooth-outline"
              size={22}
              color={mobileTheme.colors.primaryDark}
            />
          </View>

          <View style={styles.contextHeaderText}>
            <Text style={styles.contextEyebrow}>
              ORAL HEALTH MANAGEMENT
            </Text>

            <Text style={styles.contextTitle}>
              Recent recorded context
            </Text>
          </View>
        </View>

        <View style={styles.miniStatRow}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>
              {oralHealthSummary.recentLogCount
              ?? recentLogs.length}
            </Text>

            <Text style={styles.miniStatLabel}>
              Recent logs
            </Text>
          </View>

          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>
              {contextualEducation.length}
            </Text>

            <Text style={styles.miniStatLabel}>
              Related topics
            </Text>
          </View>
        </View>

        <Text style={styles.contextBody}>
          {latestLogDate
            ? `Latest saved log: ${formatDateKey(latestLogDate)}.`
            : 'No recent Daily Oral Health Log is available yet.'}
        </Text>

        <View style={styles.authorityBox}>
          <Text style={styles.authorityTitle}>
            Recorded context only
          </Text>

          <Text style={styles.authorityText}>
            Oral Health Management entries help the AI explain your existing records. They do not become a diagnosis.
          </Text>
        </View>
      </View>

      <View style={styles.contextCard}>
        <View style={styles.contextCardHeader}>
          <View style={styles.contextIcon}>
            <Ionicons
              name="book-outline"
              size={21}
              color={mobileTheme.colors.primaryDark}
            />
          </View>

          <View style={styles.contextHeaderText}>
            <Text style={styles.contextEyebrow}>
              DENTAL HEALTH EDUCATION
            </Text>

            <Text style={styles.contextTitle}>
              Approved education
            </Text>
          </View>
        </View>

        {contextualEducation.length ? (
          contextualEducation
            .slice(0, 3)
            .map((article) => (
              <View
                key={article.id}
                style={styles.educationItem}
              >
                <Text style={styles.educationCategory}>
                  {article.category
                  || 'Dental Health Education'}
                </Text>

                <Text style={styles.educationTitle}>
                  {article.title}
                </Text>
              </View>
            ))
        ) : (
          <Text style={styles.contextBody}>
            No contextual Dental Health Education topics are currently matched to your recent logs.
          </Text>
        )}

        <View style={styles.authorityBox}>
          <Text style={styles.authorityTitle}>
            Education, not diagnosis
          </Text>

          <Text style={styles.authorityText}>
            Critical education continues to come from NgitiFy&apos;s approved Dental Health Education library rather than depending on AI generation.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderQuickPrompts = () => (
    <View style={styles.quickPromptSection}>
      <Text
        style={styles.quickPromptLabel}
        accessibilityRole="header"
      >
        Try asking
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.promptScroll}
        contentContainerStyle={styles.promptContent}
      >
        {QUICK_PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt.id}
            style={styles.promptChip}
            onPress={() =>
              sendMessage(prompt.label)
            }
            disabled={sending}
            activeOpacity={0.84}
            accessibilityRole="button"
          >
            <Ionicons
              name={prompt.icon}
              size={17}
              color={mobileTheme.colors.primaryDark}
            />

            <Text style={styles.promptChipText}>
              {prompt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderConversation = () => (
    <View style={styles.conversationCard}>
      <View style={styles.conversationHeader}>
        <View style={styles.aiAvatar}>
          <Ionicons
            name="sparkles"
            size={18}
            color={mobileTheme.colors.primaryDark}
          />
        </View>

        <View style={styles.conversationHeaderText}>
          <Text style={styles.contextEyebrow}>
            CONVERSATION
          </Text>

          <Text style={styles.conversationTitle}>
            Ask NgitiFy
          </Text>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearConversation}
          disabled={
            sending
            || messages.length <= 1
          }
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.clearButtonText}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {messages.map((message) => {
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
              <View style={styles.messageAvatar}>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color={mobileTheme.colors.primaryDark}
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
      })}

      {sending ? (
        <View
          style={[
            styles.messageRow,
            styles.messageRowAssistant,
          ]}
        >
          <View style={styles.messageAvatar}>
            <Ionicons
              name="sparkles"
              size={14}
              color={mobileTheme.colors.primaryDark}
            />
          </View>

          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
            ]}
          >
            <View style={styles.typingRow}>
              <ActivityIndicator
                size="small"
                color={mobileTheme.colors.primaryDark}
              />

              <Text style={styles.typingText}>
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
            size={21}
            color={mobileTheme.colors.primaryDark}
          />

          <View style={styles.chatErrorContent}>
            <Text style={styles.chatErrorTitle}>
              AI explanation unavailable
            </Text>

            <Text style={styles.chatErrorText}>
              {chatError}
            </Text>

            {lastFailedPrompt ? (
              <TouchableOpacity
                style={styles.retryButton}
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
                  color={mobileTheme.colors.primaryDark}
                />

                <Text style={styles.retryButtonText}>
                  Retry
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackIcon
            width={16}
            height={16}
            fill={mobileTheme.colors.primary}
          />

          <Text style={styles.backText}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            AI Care Companion
          </Text>

          <Text style={styles.headerSubtitle}>
            Explanation and education
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroCompactRow}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="sparkles"
                size={22}
                color={mobileTheme.colors.primaryDark}
              />
            </View>

            <View style={styles.heroCompactText}>
              <Text style={styles.heroEyebrow}>
                PATIENT AI ASSISTANT
              </Text>

              <Text style={styles.heroTitle}>
                Ask about your NgitiFy care
              </Text>
            </View>
          </View>

          <Text style={styles.heroText}>
            Get explanations of your System Recommendation, Oral Health Management records, Dental Health Education, and appointments.
          </Text>

          <View style={styles.heroDisclaimer}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={mobileTheme.colors.primaryDark}
            />

            <Text style={styles.heroDisclaimerText}>
              AI is educational and explanatory only. It does not diagnose conditions, calculate medical urgency, or replace your dentist&apos;s recommendation.
            </Text>
          </View>
        </View>

        {renderConversation()}

        {renderCareContext()}

        <View style={styles.bottomDisclaimer}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={mobileTheme.colors.primaryDark}
          />

          <Text style={styles.bottomDisclaimerText}>
            Your System Recommendation remains separate from AI Explanation. Contact the clinic if symptoms persist, worsen, or concern you.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.chatDock}>
        {renderQuickPrompts()}

        <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your care information..."
          placeholderTextColor={
            mobileTheme.colors.textSoft
          }
          multiline
          maxLength={1500}
          editable={!sending}
          returnKeyType="default"
          accessibilityLabel="Ask the Patient AI Assistant"
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
          onPress={() => sendMessage()}
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
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingTop: mobileTheme.spacing.md,
    paddingBottom: 26,
  },

  header: {
    minHeight: 76,
    paddingTop: mobilePageTopInset,
    paddingHorizontal: mobileTheme.spacing.md,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },
  backButton: {
    width: 72,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: 6,
    color: mobileTheme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: mobileTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 2,
    color: mobileTheme.colors.textSoft,
    fontSize: 10,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 72,
  },

  heroCard: {
    padding: 16,
    borderRadius: mobileTheme.radii.lg,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
    ...mobileTheme.shadows.soft,
  },

  heroCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroCompactText: {
    flex: 1,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },
  heroEyebrow: {
    marginBottom: 6,
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: mobileTheme.colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  heroText: {
    marginTop: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  heroDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 13,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.backgroundMuted,
  },
  heroDisclaimerText: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },

  contextSection: {
    marginTop: 18,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionEyebrow: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    marginTop: 4,
    color: mobileTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  careErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 14,
    borderRadius:
      mobileTheme.radii.md,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.borderStrong,
    backgroundColor:
      mobileTheme.colors.backgroundMuted,
  },
  careErrorText: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  contextCard: {
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },
  contextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  contextIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginRight: 10,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },
  contextHeaderText: {
    flex: 1,
  },
  contextEyebrow: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  contextTitle: {
    marginTop: 3,
    color: mobileTheme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  contextLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contextLoadingText: {
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius:
      mobileTheme.radii.pill,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },
  statusBadgeText: {
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  recommendationWindow: {
    marginTop: 11,
    color: mobileTheme.colors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  contextBody: {
    marginTop: 10,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
  },
  authorityBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
  },
  authorityTitle: {
    marginBottom: 4,
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  authorityText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
  },

  contactNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.borderStrong,
  },
  contactNoticeText: {
    flex: 1,
    marginLeft: 9,
  },
  contactNoticeTitle: {
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  contactNoticeBody: {
    marginTop: 3,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },

  miniStatRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  miniStat: {
    flex: 1,
    marginHorizontal: 4,
    padding: 12,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.backgroundMuted,
  },
  miniStatValue: {
    color:
      mobileTheme.colors.primaryDark,
    fontSize: 19,
    fontWeight: '800',
  },
  miniStatLabel: {
    marginTop: 2,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },

  educationItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor:
      mobileTheme.colors.border,
  },
  educationCategory: {
    color:
      mobileTheme.colors.secondaryDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  educationTitle: {
    marginTop: 4,
    color: mobileTheme.colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  quickPromptSection: {
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  quickPromptLabel: {
    paddingHorizontal:
      mobileTheme.spacing.md,
    marginBottom: 8,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  promptScroll: {
    marginHorizontal: 0,
  },

  promptContent: {
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingBottom: 2,
  },

  promptChip: {
    maxWidth: 210,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
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

  conversationCard: {
    marginTop: 16,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginRight: 9,
    backgroundColor:
      mobileTheme.colors.primarySoft,
  },
  conversationHeaderText: {
    flex: 1,
  },
  conversationTitle: {
    marginTop: 2,
    color: mobileTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  clearButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius:
      mobileTheme.radii.pill,
  },
  clearButtonText: {
    color:
      mobileTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 2,
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
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  assistantBubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surfaceAlt,
  },
  userBubble: {
    borderRadius: 16,
    borderBottomRightRadius: 5,
    backgroundColor:
      mobileTheme.colors.primary,
  },
  messageText: {
    color: mobileTheme.colors.text,
    fontSize: 12,
    lineHeight: 19,
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
      mobileTheme.colors.backgroundMuted,
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

  bottomDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    padding: 14,
    borderRadius:
      mobileTheme.radii.md,
    backgroundColor:
      mobileTheme.colors.backgroundMuted,
  },
  bottomDisclaimerText: {
    flex: 1,
    marginLeft: 9,
    color:
      mobileTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
  },

  chatDock: {
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surface,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal:
      mobileTheme.spacing.md,
    paddingTop: 4,
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
      mobileTheme.colors.border,
    backgroundColor:
      mobileTheme.colors.surfaceAlt,
    color: mobileTheme.colors.text,
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
});