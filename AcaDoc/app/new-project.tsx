import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';

const TEMPLATES = [
  {
    id: 'diploma-project-report',
    label: 'Diploma / Project Report',
    description: 'Certificate, abstract, TOC, chapters with header/footer',
    icon: '🎓',
  },
  {
    id: 'thesis',
    label: 'Thesis',
    description: 'Full thesis structure with front matter and chapters',
    icon: '📚',
  },
  {
    id: 'ieee-paper',
    label: 'IEEE Paper',
    description: 'Two-column IEEE format with abstract and keywords',
    icon: '🔬',
  },
  {
    id: 'assignment',
    label: 'Assignment',
    description: 'Clean assignment format with title page',
    icon: '📝',
  },
  {
    id: 'blank',
    label: 'Blank Document',
    description: 'Start from scratch with no predefined structure',
    icon: '📄',
  },
];

type Step = 'template' | 'details';

export default function NewProjectScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const C       = Colors[scheme];

  const createProject = useProjectStore(s => s.createProject);

  const [step, setStep]           = useState<Step>('template');
  const [selectedId, setSelected] = useState('diploma-project-report');
  const [title, setTitle]         = useState('');
  const [authors, setAuthors]     = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment]   = useState('');
  const [guide, setGuide]             = useState('');
  const [year, setYear]               = useState(String(new Date().getFullYear()));
  const [titleErr, setTitleErr]       = useState('');

  function handleCreate() {
    if (!title.trim()) { setTitleErr('Project title is required'); return; }
    const project = createProject(selectedId, {
      title: title.trim(),
      authors: authors.trim(),
      institution: institution.trim(),
      department: department.trim(),
      guide: guide.trim(),
      year: year.trim(),
    });
    router.replace({ pathname: '/editor/[projectId]', params: { projectId: project.id } });
  }

  const selectedTemplate = TEMPLATES.find(t => t.id === selectedId)!;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Space.md, backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => step === 'details' ? setStep('template') : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>
          {step === 'template' ? 'Choose template' : 'Project details'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'template' ? (
          /* ── Step 1: Template picker ── */
          <View style={styles.section}>
            <Text style={[styles.sectionHint, { color: C.textMuted }]}>
              Choose the format that best fits your document
            </Text>
            <View style={styles.templateList}>
              {TEMPLATES.map(t => {
                const isSelected = t.id === selectedId;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSelected(t.id)}
                    activeOpacity={0.8}
                  >
                    <Card style={[
                      styles.templateCard,
                      ...(isSelected ? [{ borderColor: Brand.accent, borderWidth: 2 }] : []),
                    ] as any}>
                      <View style={styles.templateCardRow}>
                        <View style={[styles.templateIconWrap, { backgroundColor: isSelected ? Brand.accentLight : C.surfaceAlt }]}>
                          <Text style={styles.templateIcon}>{t.icon}</Text>
                        </View>
                        <View style={styles.templateInfo}>
                          <Text style={[styles.templateLabel, { color: C.text }]}>{t.label}</Text>
                          <Text style={[styles.templateDesc, { color: C.textMuted }]}>{t.description}</Text>
                        </View>
                        <View style={[
                          styles.radioOuter,
                          { borderColor: isSelected ? Brand.accent : C.borderStrong },
                        ]}>
                          {isSelected && <View style={[styles.radioInner, { backgroundColor: Brand.accent }]} />}
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              label={`Use "${selectedTemplate.label}"`}
              onPress={() => setStep('details')}
              size="lg"
              style={{ marginTop: Space.lg }}
            />
          </View>
        ) : (
          /* ── Step 2: Metadata ── */
          <View style={styles.section}>
            <View style={[styles.selectedBadge, { backgroundColor: C.accentLight }]}>
              <Text style={styles.selectedBadgeIcon}>{selectedTemplate.icon}</Text>
              <Text style={[styles.selectedBadgeText, { color: C.accent }]}>{selectedTemplate.label}</Text>
            </View>

            <Text style={[styles.sectionHint, { color: C.textMuted }]}>
              These appear on your title page. You can edit them later.
            </Text>

            <View style={styles.form}>
              <Input
                label="Project / Document title *"
                placeholder="e.g. AI Document Formatter"
                value={title}
                onChangeText={v => { setTitle(v); setTitleErr(''); }}
                error={titleErr}
                autoCapitalize="words"
              />
              <Input
                label="Author(s)"
                placeholder="e.g. Rahul Sharma, Priya Patel"
                value={authors}
                onChangeText={setAuthors}
                autoCapitalize="words"
              />
              <Input
                label="Institution / College"
                placeholder="e.g. MIT College of Engineering"
                value={institution}
                onChangeText={setInstitution}
                autoCapitalize="words"
              />
              <Input
                label="Department"
                placeholder="e.g. Computer Engineering"
                value={department}
                onChangeText={setDepartment}
                autoCapitalize="words"
              />
              <Input
                label="Guide / Supervisor"
                placeholder="e.g. Prof. A. Kumar"
                value={guide}
                onChangeText={setGuide}
                autoCapitalize="words"
              />
              <Input
                label="Year"
                placeholder={String(new Date().getFullYear())}
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            <Button
              label="Create project"
              onPress={handleCreate}
              size="lg"
              style={{ marginTop: Space.xl }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1,
  },
  backBtn: { width: 30 },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700' },
  scroll:   { padding: Space.lg },
  section:  { gap: Space.md },
  sectionHint: { fontSize: FontSize.sm, lineHeight: 20 },

  templateList: { gap: Space.sm },
  templateCard: { padding: Space.md },
  templateCardRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  templateIconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  templateIcon: { fontSize: 22 },
  templateInfo: { flex: 1 },
  templateLabel: { fontSize: FontSize.base, fontWeight: '600' },
  templateDesc: { fontSize: FontSize.xs, marginTop: 2, lineHeight: 16 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm,
    alignSelf: 'flex-start', paddingHorizontal: Space.md, paddingVertical: Space.xs,
    borderRadius: Radius.full,
  },
  selectedBadgeIcon: { fontSize: 16 },
  selectedBadgeText: { fontSize: FontSize.sm, fontWeight: '600' },
  form: { gap: Space.md },
});
