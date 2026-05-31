# Media Platform — Product Strategy Document
### A retention-first architecture for a social media tracking platform

---

## Preface: The Real Problem You're Solving

Before anything else, a brutal reframe: **you are not building a better Letterboxd.** You are building a social identity platform that happens to organize media. The moment you forget this, you'll optimize for the wrong things — logging friction, library completeness, search accuracy — and miss the emotional substrate that makes people actually stay.

The platforms people emotionally attach to are not the ones with the best features. They are the ones where **leaving feels like losing something about yourself.**

---

## Section 1: Retention-First Product Strategy

### The Retention Stack (from weakest to strongest)

**Tier 1 — Utility hooks** (lowest stickiness, easiest to replace)
Logging, rating, searching. Every competitor has this. Users leave when a better UI arrives.

**Tier 2 — Content hooks** (medium stickiness)
Watchlists, reviews, lists. Users start to feel invested. Switching cost is moderate — "I'd have to move all my stuff."

**Tier 3 — Social hooks** (high stickiness)
Followers, mutual taste overlap, following someone's taste journey over time. Switching cost is significant — "I'd lose my audience and my social graph."

**Tier 4 — Identity hooks** (near-irreversible)
Badges, streaks, taste profile, profile aesthetics, public-facing reputation. Switching cost is existential — "My identity lives here."

**Critical insight**: Most logging apps get stuck at Tier 2. Letterboxd barely touches Tier 3. Almost nothing operates at Tier 4 consistently. **Your entire strategy should be building Tier 4 from day one**, even if it means Tier 1 is slightly less polished at launch.

### The Habit Loop Architecture

For a user to return daily without being pushed, they need all three:

1. **Cue** — Something pulls them back (notification, streak reminder, friend activity)
2. **Routine** — The action is fast and satisfying (logging takes under 30 seconds)
3. **Reward** — The reward is variable and social, not just completion

The mistake most apps make: they reward completion (you logged a movie ✓) instead of social escalation (your review got 47 likes, someone quoted your list in theirs). Completion rewards are flat. Social rewards are variable and compulsive.

**Design principle**: Every core action (log, rate, review, list) should have a social echo that returns asynchronously. The gap between action and social reward is where compulsion lives.

### Retention Metrics You Must Instrument From Day One

- D1 / D7 / D30 / D90 retention rates by acquisition source
- Median time to first social action (follow, comment, like)
- Correlation between badge unlock and 30-day retention
- List creation → follower growth rate
- Streak length distribution and drop-off cliff analysis
- % of users who log within 48h of signing up (onboarding quality proxy)

---

## Section 2: Viral and Social Growth Loops

### Loop 1 — The Taste Share Loop (primary viral mechanism)

User logs media → rates it → platform generates a shareable "taste card" with their rating, a micro-review, and their profile badge cluster → user shares to Twitter/Instagram Stories/Discord → viewer clicks → lands on logged item page with the user's full profile visible → converts.

**What makes this work**: The card doesn't just share an opinion. It signals identity. "This person has watched 800 things, has the Horror Obsessive badge, and gave Hereditary a 9." That's more compelling than a plain star rating.

**What kills this**: Generic templates. The card must feel personal and expressive — pulled from their actual profile aesthetic, badge color palette, taste keywords. If it looks like everyone else's, sharing behavior drops to near zero.

### Loop 2 — The Rivalry Loop (retention + referral)

Users can send a "taste challenge" to a friend: "How much do our tastes overlap?" The challenge generates a comparison card showing shared watches, rating divergence on the same titles, and a compatibility score.

This is pulled directly from competitive psychology. People are motivated to see themselves relative to others. The challenge is both a retention mechanism (revisiting your profile to see how it changed) and a viral referral (the challenged friend must sign up to complete it).

**Second-order effect to manage**: Taste comparison can become negative if someone's score is consistently low. Design the framing carefully — "interestingly different" is better than "incompatible."

### Loop 3 — The List Discovery Loop (content-led growth)

Highly curated lists by power users surface on SEO-indexed pages. "Best Slow Cinema Films You've Never Heard Of" gets indexed, ranks for long-tail queries, and drives organic users who find it via Google. They land on a beautiful list page that prompts them to save it, follow the list author, and sign up to track which ones they've seen.

This is how Letterboxd gets enormous organic traffic — via user-generated lists that rank for niche queries. You should actively incentivize list creation with visibility rewards (featured lists, list author badges, follower count display on lists).

### Loop 4 — The Activity Feed Pull Loop

The feed isn't just "friends watched X." It's: friends watched X, wrote something surprising about it, and now 12 people are having a disagreement in the comments. The social tension is the pull.

**Design principle**: Surface friction, not consensus. Disagreement is engagement. Show when two followed users rated the same film at 10 and 2 respectively. Give users a way to "weigh in" from the feed without navigating away.

---

## Section 3: Depth Engagement Without Shallow Dopamine

This is the hardest design problem and where most social apps fail.

### The Dopamine Trap Taxonomy

**Shallow dopamine** (destroys long-term engagement):
- Infinite scroll with no meaningful content density
- Like counts prominently displayed everywhere
- Notification spam for low-signal events
- Streak pressure that feels punitive rather than earned
- Leaderboards that only reward quantity, not quality

**Deep engagement** (builds long-term attachment):
- Discovery that surfaces something genuinely surprising
- Social moments that feel rare and meaningful
- Progress that reflects actual taste development over time
- Rewards tied to specific expertise, not just activity volume

### Concrete Design Principles for Depth

**Principle 1 — Scarcity in reward signals**
Not every action deserves a badge. If badges are given out freely, they become meaningless. A badge for "watched 10 films" is noise. A badge for "watched all of Andrei Tarkovsky's filmography" is identity.

**Principle 2 — Qualitative over quantitative metrics on profiles**
Don't lead with "logged 1,247 films." Lead with taste signatures: genres skewed toward, directors frequently rewatched, average rating distribution, most contrarian opinions. These are more interesting and harder to fake.

**Principle 3 — Reward consistency, not volume**
A user who writes thoughtful 3-sentence reviews for 50 films is more valuable to your community than one who star-rates 500 films with no reviews. Your algorithmic signals should reflect this. Consider a "review quality score" derived from engagement (saves, shares, likes, comments) rather than length.

**Principle 4 — The Completionist Track**
Filmographies, director retrospectives, studio catalogues, seasonal watchlists — structured challenges that reward completion with permanent profile markers. These create medium-term engagement arcs (weeks to months) rather than daily habit loops. They also serve discovery: the reason to watch something shifts from "I heard it's good" to "it completes this arc I'm on."

---

## Section 4: Identity and Emotional Attachment Systems

### The Identity Stack

A user's identity on your platform should be composed of:

1. **Taste signature** — auto-generated from logged media. Not just "you like horror" but "you gravitate toward slow, atmospheric horror with ambiguous endings, especially Japanese and Korean productions."

2. **Reputation markers** — badges, list follower counts, review like counts, curator status

3. **Aesthetic expression** — profile customization (colors, header images, bio, featured lists)

4. **Social position** — who follows them, who they follow, mutual taste overlap scores

5. **History and tenure** — how long they've been here, early member status, milestone badges

**Critical design note**: The taste signature must feel discovered, not assigned. Users should feel like the platform revealed something true about them, not labeled them. Language matters enormously here. "Atmospheric horror aficionado" feels different from "watches a lot of horror."

### Emotional Attachment Triggers

**The "this place knows me" moment**: Occurs when a recommendation or discovery feels impossible to find elsewhere. The platform surfaced something that felt personally curated. This is a retention-defining event. Every user should hit this within their first week.

**The "I belong here" moment**: Occurs when a user's opinion (review, list, rating) gets a genuine social response — not just a like, but a comment that engages with their actual argument. Design the social layer to encourage this specifically.

**The "I've built something here" moment**: Occurs when a user looks at their profile and feels pride. This is the Tier 4 hook. It requires profile customization, public-facing history, and visible markers of expertise.

### Profile Prestige Architecture

Profiles should communicate status at a glance without being garish:

- **Badge clusters** positioned prominently but not loudly — subtle visual weight, not notification-style popups
- **Taste keywords** as a stylized text element — not a tag cloud, an actual designed element
- **Signature reviews** — the user can pin their best reviews to their profile
- **List portfolio** — top lists displayed like a curated grid, not a flat list
- **Activity signature** — a compressed visual history (like a GitHub contribution graph, but for media)

The prestige comes from what the profile contains, not from explicit status labels. "Elite Member" badges are shallow. A profile with 40 curator-quality lists, 1,200 reviews, and a taste signature that reads like a genuine human being is prestigious in a way that feels earned.

---

## Section 5: Network Effects and Community Mechanics

### Network Effect Types

**Same-side network effects**: More users → better recommendation algorithm → better discovery → more satisfied users. Standard, but requires critical mass.

**Cross-side network effects**: Power users (reviewers, list curators) attract casual users who consume their content. Casual users provide social validation (likes, follows) that retain power users. This is the flywheel.

**Data network effects**: More logged media → richer taste profiles → more accurate compatibility scores → more meaningful social connections. This compounds over time and becomes a genuine competitive moat.

### Designing for Power Users First

**Critical insight that most platforms miss**: Your platform lives or dies on the behavior of your top 5% of users. These are the people writing long-form reviews, building 30-title lists, logging obsessively, and generating content that casual users consume.

Design decisions that hurt power users but help casual users are almost always wrong in the long run. Power users are the content engine. Casuals are the audience.

Specific design requirements for power users:
- Bulk import from Letterboxd, IMDb, Anilist (zero-friction migration)
- Advanced list management (reorder, nest, annotate)
- Rich text reviews with formatting
- Analytics on their own profile (who's following their lists, which reviews are getting traction)
- Direct recognition — featured lists, curator spotlights, verified taste status

### Community Mechanics

**Niche community formation over mass community**: Don't try to build "the community." Build conditions where micro-communities form around specific taste niches — J-horror fans, Criterion completionists, anime seasonal watchers, etc.

Tags and theme clusters are the infrastructure for this. The social graph naturally segments when discovery is niche-specific.

**Avoid the "airport book" problem**: When a platform grows, it tends toward the mainstream. The content that gets likes and follows is what's popular, not what's niche and excellent. This drives away power users who value depth over breadth.

Counter-mechanism: Separate algorithmic signals for "popular in general" and "popular among people with your taste profile." The latter is more valuable and harder to game.

---

## Section 6: What Would Realistically Make Users Leave Existing Platforms

### Letterboxd's Real Weaknesses (not the obvious ones)

**1. TV and anime are second-class citizens** — Letterboxd added TV support late and it's half-implemented. Anime fans specifically have built parallel ecosystems on Anilist because Letterboxd doesn't serve them well. If you serve the anime audience well, you have a genuine foothold that doesn't require head-on competition.

**2. Discovery is effectively broken for anything non-English or pre-2000** — Letterboxd's discovery surfaces what's socially popular, not what's relevant to a specific taste profile. This is a solvable problem and a real pain point.

**3. The social graph is asymmetric and weak** — You follow critics and film people who never interact with your content. Real communities don't form. The platform has an audience relationship, not a community relationship.

**4. Profiles don't feel like identity** — They feel like spreadsheets with a bio attached. There's no expression, no narrative arc, no sense that someone built something there.

**5. No progression systems** — There's no sense of growth, no milestone moments, no medium-term goals. You log forever with no feedback on what that accumulation means.

### Migration Triggers

Users will migrate when:
- A friend whose taste they respect is visibly active on your platform
- Their existing data can be imported in under 5 minutes
- Something in the first session feels genuinely better (discovery, UI, a recommendation that surprises them)
- The social experience on your platform has visible activity — they don't land on an empty feed

The empty feed problem is existential at launch. Solve this with curated content, featured lists, and editorial discovery that doesn't require an active social graph.

---

## Section 7: The Most Dangerous Weaknesses in Your Current Thinking

### Weakness 1 — Achievements without meaning

Badges displayed publicly sounds good until you think about the second-order effect: if badges are earned too easily, they become noise. If they're earned for quantity (logged 100 films), they reward the wrong behavior. The badge system needs a curation layer. Some badges should feel genuinely rare and specific — "watched every Palme d'Or winner," "logged 50 anime series in a single season," "wrote reviews that averaged 50+ likes."

**Risk**: You build an achievement system that looks impressive in screenshots but doesn't actually shape behavior or create prestige.

### Weakness 2 — "Better UX" is not a moat

Better UI gets you a conversion spike when you launch. It does not retain users. UI advantages evaporate as competitors iterate. Your real competitive position must be in data (richer taste profiles), social (actual community), and content (better discovery). If your differentiation story is "we're more beautiful," you will be cloned and outcompeted by a better-funded team within 18 months.

### Weakness 3 — Trying to do movies, TV, and anime simultaneously at launch

This is a surface-area trap. Three content types means three metadata schemas, three discovery systems, three content libraries to maintain, three user behavior patterns to design for. If you try to do all three well at launch, you'll do all three poorly.

**Recommendation**: Launch with movies + anime as your focus. Anime is genuinely underserved and has a passionate, high-engagement user base. TV can come later. Being the best platform for movie and anime fans is a defensible position. Being a mediocre version of Letterboxd + Anilist + Trakt is not.

### Weakness 4 — Streaks without safeguards

Streaks create powerful habit loops but have a sharp failure mode: miss one day and the psychological cost is severe enough to cause abandonment rather than recommitment. Duolingo has spent years refining streak protection mechanics (streak freezes, grace periods).

If you implement streaks, you need: streak shields (earned or purchasable), grace period logic, and streak-recovery mechanics. Missing a streak should be a recoverable moment, not a cliff.

### Weakness 5 — The cold start problem for social features

Social features that require critical mass (compatibility scores, activity feeds, taste-based friend suggestions) are inert at launch. If a user signs up, follows nobody, and sees an empty feed, they will not return.

Design social features to be compelling at scale of zero: a new user with no followers should still experience a rich social signal via curated editorial content, trending lists, featured reviewers, and taste-matched discovery.

### Weakness 6 — Ignoring the creator economy inside your platform

Your power users are implicitly content creators. They write reviews people read, curate lists people follow, build taste profiles people trust. If you don't give them explicit creator tools and recognition, they will feel unacknowledged and eventually migrate to a platform that does recognize them.

Consider: creator dashboards showing reach, featured placement in discovery, ability to create "branded" lists with headers and descriptions, and eventually — when scale justifies it — revenue sharing from ads adjacent to high-traffic lists.

---

## Section 8: Features to Remove (or Defer)

### Remove: Quantity-based public stats as primary profile metrics

"Logged 1,247 films" as a headline profile stat incentivizes logging volume over quality engagement. It also immediately disadvantages new users, making the platform feel hierarchical in a discouraging way.

Replace with: taste signatures, qualitative markers, specific achievement badges. Volume stats can exist but should be secondary.

### Remove: Generic activity notifications

"[User] liked your review" is noise. Notification fatigue kills engagement. Every notification should either be high-signal (someone you follow wrote a review of something on your watchlist) or actionable (a friend challenged you to a taste comparison).

Build a notification quality filter from day one. Default to fewer, higher-signal notifications rather than more.

### Defer: Community forums / general discussion boards

Moderation cost is enormous. Low-quality discussion destroys platform reputation. Structured social (reviews, comments on specific media, lists) is far easier to keep high-quality than open forums. Do not build forums until you have moderation infrastructure and a community norms layer.

### Defer: In-app streaming links / affiliate integrations

This is a distraction at launch and introduces commercial incentives that users will notice and resent. Focus entirely on the social/identity layer. Streaming availability data can be a utility feature added later without compromising the product's soul.

### Remove: Stars-only rating without decimal or half-step options

Integer star ratings flatten nuance. If someone can only express "4 stars" instead of "4.2" or "4.5," their rating loses signal. Letterboxd uses half-stars. Consider whether you want to go further with a 10-point or 100-point system — many anime platforms use 10-point, which gives more expressive resolution.

---

## Section 9: High-Impact Feature Roadmap

Features ranked across four dimensions: **Retention Impact (R), Virality (V), Implementation Difficulty (D, 1=easy), Uniqueness (U)**

### Tier 0 — Launch-Critical (must exist at launch)

| Feature | R | V | D | U | Notes |
|---|---|---|---|---|---|
| Bulk import from Letterboxd / Anilist | High | Medium | 3 | Low | Non-negotiable. Migration barrier removal. |
| Taste signature (auto-generated profile) | High | High | 4 | High | Key differentiator. |
| Empty-state feed with editorial content | High | Low | 2 | Low | Solves cold start. |
| Fast logging (< 30 sec) | High | Low | 2 | Low | Table stakes but must be excellent. |
| Shareable taste cards for social | Medium | High | 3 | Medium | Primary viral mechanism. |

### Tier 1 — First 90 Days

| Feature | R | V | D | U | Notes |
|---|---|---|---|---|---|
| Completionist challenges (filmographies, curated sets) | High | Medium | 3 | High | Medium-term engagement arcs. |
| Rivalry / taste comparison with friends | High | High | 3 | Medium | Referral + retention. |
| Rare badge system (specific, quality-gated) | High | Medium | 2 | High | Prestige system core. |
| Streak system with protection mechanics | High | Low | 3 | Low | Habit loop infrastructure. |
| Advanced anime support (seasons, MAL data) | High | Medium | 4 | High | Underserved market. |
| Notification quality filter | High | Low | 2 | Low | Retention protection. |

### Tier 2 — Months 3–6

| Feature | R | V | D | U | Notes |
|---|---|---|---|---|---|
| Curator status / power user recognition | High | Medium | 2 | Medium | Creator retention. |
| SEO-indexed list pages | Medium | High | 3 | Low | Organic growth engine. |
| Taste-matched discovery (not popularity-based) | High | Medium | 5 | High | Core moat. |
| Activity signature / profile history visual | Medium | Medium | 3 | High | Tier 4 identity hook. |
| Director / creator deep-dives | Medium | Medium | 4 | Medium | Discovery differentiation. |

### Tier 3 — Months 6–12

| Feature | R | V | D | U | Notes |
|---|---|---|---|---|---|
| Profile customization (themes, layouts) | Medium | Medium | 4 | Medium | Identity expression. |
| Creator analytics dashboard | High | Low | 3 | Medium | Power user retention. |
| Social lists (collaborative curation) | Medium | High | 4 | Medium | Community mechanic. |
| Seasonal anime tracking (episodic) | High | Low | 5 | Medium | Anime community specific. |
| Advanced taste matching / friend discovery | High | Medium | 5 | High | Network effect accelerant. |

---

## Section 10: Psychological Triggers in Successful Social/Tracking Apps

### Variable Reward (intermittent reinforcement)
The most powerful retention mechanism. Social feedback (likes, comments, new followers) should not be predictable. The feed should surface old reviews getting new attention, lists gaining followers from discovery, taste comparisons with unexpected results. The unpredictability is the mechanism.

### Loss Aversion
Streaks leverage this. A 30-day streak creates psychological ownership — losing it feels worse than the neutral baseline. Use carefully: the downside of punitive loss aversion is churn, not engagement. Streaks should feel like an asset to protect, not a punishment system.

### Social Comparison (upward and lateral)
Upward comparison (seeing someone with a better-developed taste profile) is motivating when the gap feels achievable. It's demotivating when the gap feels permanent. Design your comparison surfaces carefully — emphasize taste similarity and shared watches alongside differences in volume or depth.

### The Endowment Effect
Users feel ownership over profiles they've built, lists they've curated, reviews they've written. This makes switching feel like loss. Design features that increase the sense of ownership: profile customization, achievement display, contribution history.

### The Zeigarnik Effect
Incomplete tasks create cognitive tension that pulls people back. Watchlists, incomplete challenges, partially-completed filmographies — these are Zeigarnik loops. Surface incomplete tasks prominently but without being nagging.

### Social Proof at the Individual Level
Not "10,000 users loved this" — that's generic. "Two people whose taste aligns with yours gave this 9/10" — that's personally relevant social proof. Build toward personalized social proof signals as your data grows.

---

## Section 11: Making Profiles Feel Prestigious and Expressive

### The Design Hierarchy of Profile Prestige

1. **Scarcity signals**: Badges that are genuinely rare. Early member markers. Completion awards for difficult challenges. These should be visually distinct — not just a different color, but a different design language.

2. **Quality signals**: Review likes, list follower counts, curator designation. These reward contribution quality, not just activity volume.

3. **Depth signals**: Taste signature richness (how detailed and specific it is), number of directors fully covered, genre depth metrics. These say "this person has serious taste."

4. **Expression signals**: Profile customization, pinned reviews, list curation quality, bio writing. These say "this person has a voice."

### Technical Design Principles

- Profile should load fast and look beautiful on a cold visit (someone clicking from a shared card)
- First-time profile visitors should immediately understand what kind of watcher this person is — not from reading, but from scanning
- Badge cluster should be displayable in a compressed form (for cards/sharing) and expanded form (for full profile)
- The "taste signature" element should be the most visually prominent thing after the avatar and name — it's the identity core

### What Letterboxd Gets Wrong Here

Letterboxd profiles feel like dashboards. They communicate data, not identity. There's no sense of curation, voice, or expression in the default layout. The only personality comes from the bio text. This is a massive design gap you can fill.

---

## Section 12: Monetization That Doesn't Ruin the Platform

### Core Principle
Monetize engagement depth, not attention or data. The moment users feel like the product is trying to extract from them rather than serve them, trust collapses. Build a revenue model where users actively want to pay because it enhances their platform identity.

### Tier 1 — Pro/Plus Subscription (primary revenue)

Justifiable paid features:
- Extended profile customization (themes, layout options, header images, custom badge frames)
- Advanced analytics on your own profile and lists
- Streak protection mechanics (freeze tokens, grace periods)
- Unlimited list length (free tier: 50 items)
- Early access to new features
- Supporter badge (visible on profile — social proof of investment in the platform)

Do NOT put core functionality behind a paywall. Logging, reviewing, and social features should be free. Monetize expression and depth, not access.

### Tier 2 — Creator Monetization (future, post-scale)

When you have 100k+ active users, explore revenue share for high-traffic lists. This creates a genuine incentive for power users to stay and create. It also makes the platform defensible — creators who earn income here don't leave.

### What to Avoid

- Ads against organic content (destroys trust immediately)
- Algorithm pay-to-play (surfaces content based on payment, not quality)
- Data monetization without explicit opt-in (legal and ethical liability)
- Locking social features (follows, comments) behind paywall (kills network effects)

---

## Section 13: Systems for High-Quality Reviews and Lists

### Review Quality Signals (not just length)

Train your ranking algorithm on:
- Engagement rate (likes + comments relative to the reviewer's follower count)
- Save rate (users saving a review to return to it)
- Comment quality (reviews that generate substantive discussion, not just emoji reactions)
- Reputation weighting (reviews from high-reputation users carry more weight)

Do not use: word count, sentence count, presence of formatting. These are gameable. Engagement signals are harder to fake.

### Discouraging Low-Effort Behavior Without Being Heavy-Handed

- Don't give equal surface area to "8/10 Great film" reviews and substantive paragraphs. Algorithm should downrank minimal-text reviews in discovery surfaces (while still showing them on the film's page).
- Rate limit certain actions for new accounts — not punitively, but to slow spam: first week, review posting limited to N per day.
- Make the review editor itself invite depth: a subtle character count encouragement ("most shared reviews are 100+ words"), optional spoiler tagging, structured prompts for new users ("What surprised you? What lingered?").

### List Quality Architecture

- Lists require a title + description to be indexed/discoverable. A list called "good films" with no description gets zero algorithmic visibility.
- Feature high-quality lists in editorial surfaces (weekly curatorial spotlight, genre-specific featured lists).
- Give list authors visibility: follower count on the list, follow button directly from the list page.
- Allow annotations on list items — a sentence next to each entry explaining why it's there. Lists with annotations have dramatically higher perceived quality and engagement.

---

## Section 14: Onboarding That Immediately Hooks New Users

### The First 10 Minutes Are Decisive

Research across social apps consistently shows that users who don't take a specific set of actions in the first session almost never become retained users. You must design the first session with surgical precision.

### Onboarding Architecture

**Step 1 — Taste seeding (2 minutes)**
Quick-rate 20–30 well-known films/shows to seed a taste profile. Do not ask for metadata or account details first. Start with the thing that's immediately satisfying: "we're learning your taste."

Make this feel like a personality quiz, not a database form. Show the results immediately after: "Based on your ratings, you gravitate toward [X]. Here are 5 things you're likely to love."

**Step 2 — First discovery hit (within 3 minutes)**
Surface one recommendation that feels genuinely surprising and specific — not "you might like The Godfather." Something that matches their specific taste cluster in a non-obvious way. This is the "this place knows me" moment. It must happen in the first session.

**Step 3 — Social seed (optional but high-value)**
"Import your contacts to find friends already here." Low friction, high value. Show mutual taste overlap scores immediately if friends are found.

**Step 4 — First log (within 5 minutes)**
Guide them to log something they watched recently. Make this effortless — search, tap, rate, done. Celebrate it with a small visual moment and the first badge earned.

**Step 5 — Profile reveal**
Show them their nascent profile with the taste signature already populated from their quick-rate session and their first log. Even with minimal data, it should look like the beginning of something worth building.

### Onboarding Anti-Patterns to Avoid

- Email verification before value delivery (huge drop-off)
- Forcing profile setup before the product demonstrates value
- Generic welcome screens with marketing copy
- Showing an empty feed as the first screen

---

## Section 15: Why Most Social/Discovery Apps Fail After Launch

### The Standard Failure Arc

**Month 1**: Launch generates attention, early adopters arrive, engagement metrics look strong because novelty creates artificial inflation.

**Month 3**: Novelty fades. The social graph is thin — early adopters know each other or follow nobody. The feed goes quiet. Discovery doesn't work without data. Power users don't feel recognized. The first cohort drifts.

**Month 6**: The product is "in maintenance mode." New feature development slows because the team is chasing metrics that never stabilized. The community never crossed the threshold into self-sustaining social dynamics.

### Root Causes

**1. Feature-led, not habit-led development**: Teams build features because they're interesting to build, not because they're positioned in the habit loop at the exact point where users are most at risk of disengaging.

**2. Solving for launch day, not day 30**: Marketing drives D1 activation. Product must drive D30 retention. These require different design priorities and many teams never make this shift.

**3. Ignoring the social graph bootstrapping problem**: A social platform that requires a social graph to deliver value is broken until it has one. Every feature must have a fallback that works with zero followers.

**4. Failing to retain power users**: The people writing the content the platform runs on are often the first to feel underserved and the first to leave. When they go, the content quality drops, casual users disengage, and the flywheel runs backward.

**5. Premature monetization pressure**: Investors push for revenue. The team adds ads or aggressive premium paywalls too early. Users feel exploited. Trust breaks. You cannot repair it.

**6. Conflating MAU with health**: Monthly active users can include people who visit once to look at a list. What matters is weekly active users who are logging, reviewing, and generating social signal. Focus on this cohort exclusively.

### What Prevents This Arc

- A social graph that produces value with zero followers from day one (editorial fills the gap)
- Explicit power user programs from launch (curator designation, featured placement)
- A habit loop that works daily without requiring new content to be produced
- Treating D7 retention as the most important metric in the business for the first year
- Patient, community-led growth rather than growth-hacked viral mechanics that bring in disengaged users

---

## Closing: The One Thing

If you had to reduce this entire document to a single directive, it would be this:

**Build the place where someone's taste feels real, recognized, and worth displaying.**

Not the place with the best features. Not the most comprehensive database. Not the most beautiful UI.

The place where someone looks at their profile after six months and thinks: *this is actually me.*

Everything else — retention, virality, monetization — is downstream of that.
