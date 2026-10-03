type SensitiveValueKind = 'credential' | 'connection';

interface SensitiveStart {
  index: number;
  length: number;
  kind: SensitiveValueKind;
}

/**
 * Stateful filter for streamed model output.
 *
 * Sensitive labels and values may arrive in different chunks. Keeping a small
 * pending suffix prevents a partial prefix from being emitted before it can be
 * classified, while ordinary text continues to stream normally.
 */
export class StreamingResponseFilter {
  private pending = '';
  private redacting: 'awaiting-value' | 'value' | null = null;

  push(chunk: string): string {
    this.pending += chunk;
    return this.drain(false);
  }

  flush(): string {
    return this.drain(true);
  }

  private drain(flush: boolean): string {
    let output = '';

    while (this.pending || this.redacting) {
      if (this.redacting) {
        if (this.redacting === 'awaiting-value') {
          this.pending = this.pending.replace(/^\s+/, '');
          if (!this.pending && !flush) return output;
          this.redacting = 'value';
        }

        const endIndex = this.pending.search(/\s/);
        if (endIndex === -1) {
          this.pending = '';
          if (!flush) return output;
        } else {
          this.pending = this.pending.slice(endIndex);
        }

        output += '[REDACTED]';
        this.redacting = null;
        continue;
      }

      const sensitiveStart = this.findSensitiveStart();
      if (sensitiveStart) {
        output += this.pending.slice(0, sensitiveStart.index);
        this.pending = this.pending.slice(
          sensitiveStart.index + sensitiveStart.length,
        );
        this.redacting =
          sensitiveStart.kind === 'credential' ? 'awaiting-value' : 'value';
        continue;
      }

      if (flush) {
        output += this.pending;
        this.pending = '';
        break;
      }

      const holdStart = this.findPotentialPrefixStart();
      output += this.pending.slice(0, holdStart);
      this.pending = this.pending.slice(holdStart);
      break;
    }

    return output;
  }

  private findSensitiveStart(): SensitiveStart | null {
    const patterns: Array<{ pattern: RegExp; kind: SensitiveValueKind }> = [
      {
        pattern: /(?:api[_-]?key|secret|password)\s*[:=]\s*/gi,
        kind: 'credential',
      },
      {
        pattern: /(?:mongodb|redis|postgresql):\/\//gi,
        kind: 'connection',
      },
    ];

    let earliest: SensitiveStart | null = null;
    for (const { pattern, kind } of patterns) {
      const match = pattern.exec(this.pending);
      if (match && (!earliest || match.index < earliest.index)) {
        earliest = { index: match.index, length: match[0].length, kind };
      }
    }
    return earliest;
  }

  private findPotentialPrefixStart(): number {
    // Optional whitespace can be arbitrarily long, so retain the complete
    // candidate label until its separator arrives.
    const labelCandidate =
      /(?:api[_-]?key|secret|password)\s*(?:[:=]\s*)?$/i.exec(this.pending);
    if (labelCandidate) return labelCandidate.index;

    const sensitivePrefixes = [
      'apikey',
      'api_key',
      'api-key',
      'secret',
      'password',
      'mongodb://',
      'redis://',
      'postgresql://',
    ];
    const lowerPending = this.pending.toLowerCase();
    const maxPrefixLength = Math.max(
      ...sensitivePrefixes.map((prefix) => prefix.length),
    );
    const firstCandidate = Math.max(0, lowerPending.length - maxPrefixLength);

    for (let index = firstCandidate; index < lowerPending.length; index++) {
      const suffix = lowerPending.slice(index);
      if (sensitivePrefixes.some((prefix) => prefix.startsWith(suffix))) {
        return index;
      }
    }

    return this.pending.length;
  }
}
