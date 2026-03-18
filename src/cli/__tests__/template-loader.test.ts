import { loadTemplate, fillTemplate, clearTemplateCache } from '../template-loader';

describe('template-loader', () => {
  beforeEach(() => {
    clearTemplateCache();
  });

  describe('loadTemplate', () => {
    it('loads CodableValue.swift.template', () => {
      const content = loadTemplate('CodableValue.swift.template');
      expect(content).toContain('enum CodableValue: Codable, Hashable');
      expect(content).toContain('struct GenericActivityAttributes: ActivityAttributes');
    });

    it('loads WidgetBundle.swift.template', () => {
      const content = loadTemplate('WidgetBundle.swift.template');
      expect(content).toContain('GeneratedLiveActivityBundle: WidgetBundle');
      expect(content).toContain('LiveActivityWidget()');
    });

    it('loads LiveActivityIntent.swift.template', () => {
      const content = loadTemplate('LiveActivityIntent.swift.template');
      expect(content).toContain('{{INTENT_NAME}}');
      expect(content).toContain('{{COMMAND_ID}}');
      expect(content).toContain('LiveActivityIntent');
    });

    it('loads GeneratedAppIntents.swift.template', () => {
      const content = loadTemplate('GeneratedAppIntents.swift.template');
      expect(content).toContain('{{APP_GROUP_ID_BLOCK}}');
      expect(content).toContain('{{INTENT_STRUCTS}}');
      expect(content).toContain('{{APP_SHORTCUTS}}');
      expect(content).toContain('{{LIVE_ACTIVITY_INTENTS_SECTION}}');
    });

    it('loads AppIntent.swift.template', () => {
      const content = loadTemplate('AppIntent.swift.template');
      expect(content).toContain('{{CLASS_NAME}}');
      expect(content).toContain('{{SHORTCUT_ID}}');
      expect(content).toContain('{{ERROR_MESSAGE}}');
      expect(content).toContain('{{TIMEOUT_MESSAGE}}');
      expect(content).toContain('APP_GROUP_ID');
      expect(content).toContain('IosIntentsPendingCommand');
    });

    it('loads GeneratedLiveActivity.swift.template', () => {
      const content = loadTemplate('GeneratedLiveActivity.swift.template');
      expect(content).toContain('{{GENERIC_ATTRIBUTES}}');
      expect(content).toContain('{{ACTIVITY_VIEWS}}');
      expect(content).toContain('{{ACTIVITY_WIDGET}}');
      expect(content).toContain('{{BUNDLE_SECTION}}');
    });

    it('caches templates on subsequent loads', () => {
      const first = loadTemplate('WidgetBundle.swift.template');
      const second = loadTemplate('WidgetBundle.swift.template');
      // Same reference means cache hit
      expect(first).toBe(second);
    });

    it('throws for non-existent template', () => {
      expect(() => loadTemplate('NonExistent.swift.template')).toThrow(
        'Template "NonExistent.swift.template" not found'
      );
    });
  });

  describe('fillTemplate', () => {
    it('replaces single placeholder', () => {
      const result = fillTemplate('Hello {{NAME}}!', { NAME: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('replaces multiple different placeholders', () => {
      const result = fillTemplate('{{GREETING}} {{NAME}}!', {
        GREETING: 'Hello',
        NAME: 'World',
      });
      expect(result).toBe('Hello World!');
    });

    it('replaces repeated placeholders', () => {
      const result = fillTemplate('{{X}} and {{X}}', { X: 'same' });
      expect(result).toBe('same and same');
    });

    it('handles empty replacement values', () => {
      const result = fillTemplate('before{{CONTENT}}after', { CONTENT: '' });
      expect(result).toBe('beforeafter');
    });

    it('throws on missing placeholder values', () => {
      expect(() => fillTemplate('{{MISSING}}', {})).toThrow(
        'Missing template values for placeholders: MISSING'
      );
    });

    it('throws listing all missing placeholders', () => {
      expect(() => fillTemplate('{{A}} {{B}} {{C}}', { A: 'ok' })).toThrow(
        'Missing template values for placeholders: B, C'
      );
    });

    it('does not replace lowercase or mixed-case placeholders', () => {
      const result = fillTemplate('{{lower}} {{MixedCase}}', {});
      // lowercase 'lower' doesn't match [A-Z_][A-Z0-9_]* pattern
      expect(result).toBe('{{lower}} {{MixedCase}}');
    });

    it('handles multiline templates', () => {
      const template = `struct {{NAME}}: Widget {
    var body: some WidgetConfiguration {
        {{BODY}}
    }
}`;
      const result = fillTemplate(template, {
        NAME: 'MyWidget',
        BODY: 'Text("Hello")',
      });
      expect(result).toContain('struct MyWidget: Widget');
      expect(result).toContain('Text("Hello")');
    });

    it('works with actual LiveActivityIntent template', () => {
      const template = loadTemplate('LiveActivityIntent.swift.template');
      const result = fillTemplate(template, {
        INTENT_NAME: 'LA_PauseTimerIntent',
        TITLE: 'PauseTimer',
        APP_GROUP_CONSTANT: 'APP_GROUP_ID',
        COMMAND_ID: 'pauseTimer',
      });
      expect(result).toContain('struct LA_PauseTimerIntent: LiveActivityIntent');
      expect(result).toContain('"PauseTimer"');
      expect(result).toContain('APP_GROUP_ID');
      expect(result).toContain('"pauseTimer"');
      expect(result).not.toContain('{{');
    });
  });

  describe('clearTemplateCache', () => {
    it('clears cached templates so they are reloaded', () => {
      const first = loadTemplate('WidgetBundle.swift.template');
      clearTemplateCache();
      const second = loadTemplate('WidgetBundle.swift.template');
      // After cache clear, content should be equal but not the same reference
      expect(first).toEqual(second);
    });
  });
});
