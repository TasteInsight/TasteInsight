export type CampusSection = 'posts' | 'dining' | 'news';

let requestedSection: CampusSection | undefined;

/** Switch-tab URLs cannot carry query parameters; keep the destination for the next show. */
export function openCampus(section: CampusSection = 'posts') {
  requestedSection = section;
  uni.switchTab({
    url: '/pages/community/index',
    fail: () => {
      if (requestedSection === section) requestedSection = undefined;
    },
  });
}

export function takeCampusSection(): CampusSection | undefined {
  const section = requestedSection;
  requestedSection = undefined;
  return section;
}
