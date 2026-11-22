# ResQMeal – Smart Food Rescue & Impact Platform

**Turning Surplus Food into Shared Meals.**

ResQMeal is a food rescue and redistribution platform designed to reduce food waste by connecting food donors with NGOs, community kitchens, and independent volunteers.

Restaurants, hotels, caterers, event organizers, and wedding hosts often have surplus edible food that goes unused. At the same time, NGOs and community organizations work continuously to provide meals to people in need.

ResQMeal bridges this gap through a centralized digital platform that enables donors to list surplus food, receivers to discover and claim available donations, and volunteers to independently coordinate collection and distribution.

Our goal is simple: **Rescue food. Feed people. Reduce waste.**

---

## 🌍 The Problem

Millions of meals are wasted while communities continue to face food insecurity.

Some of the major challenges include:

- Restaurants, hotels, and event organizers struggle to find reliable channels for redistributing surplus food.
- NGOs and community kitchens often lack real-time visibility into nearby food donations.
- Food redistribution is frequently coordinated through disconnected calls and messages.
- Donors and receivers lack a centralized way to track donation status and distribution.
- The environmental impact of food waste often goes unmeasured.

## 💡 Our Solution

ResQMeal provides a centralized platform that brings donors, receivers, and independent volunteers together.

The platform supports the complete food rescue workflow:

1. **Donate:** Donors publish details about surplus food, including quantity, food category, pickup location, and collection deadline.
2. **Discover:** NGOs and community kitchens browse available donations and find suitable opportunities.
3. **Claim:** Receivers request available food donations based on their requirements and capacity.
4. **Coordinate:** Donors and receivers coordinate collection, with independent volunteers able to participate in pickup and distribution.
5. **Track:** Donation statuses and distribution records help maintain transparency.
6. **Measure:** The platform estimates meals saved and environmental impact using recorded distribution data.

---

## ✨ Key Features

### 🍱 Food Donation Management
- Create and manage food donation listings.
- Specify food quantity, category, availability, and pickup details.
- Track donation availability and collection deadlines.
- Manage donation requests and claims.
- Update donation status throughout the rescue process.

### 🏢 Receiver Management
- Dedicated receiver experience for NGOs and community kitchens.
- Discover available food donations.
- Request or claim donations.
- Manage claimed quantities and pickup coordination.
- Track donation and distribution progress.

### 🤝 Independent Volunteer Network
- Volunteers can independently participate in food collection and distribution.
- Volunteers can discover opportunities within their service areas.
- Volunteer participation is coordinated through the platform.
- Volunteers are not employees, delivery partners, or guaranteed transportation providers.

### 📊 Impact Tracking
- Track food quantities successfully distributed.
- Estimate meals saved through verified distribution records.
- Estimate environmental impact and emissions avoided.
- Present measurable social impact through platform dashboards.

### 🔐 Authentication & Role-Based Access
- Secure user authentication.
- Role-based access for different platform participants.
- Separate experiences for donors, receivers, volunteers, and administrators.
- User profile and account management.

### 🛡️ Administration
- Centralized administrative interface.
- Manage platform users.
- Review user verification requests.
- Monitor donation activity and platform operations.
- Support transparency and responsible platform management.

---

## 👥 Platform Participants

ResQMeal is designed around four primary participant groups.

| Participant | Responsibilities |
|---|---|
| **Donors** | Restaurants, hotels, caterers, and event organizers list surplus food. |
| **Receivers** | NGOs and community kitchens discover, claim, collect, and distribute food. |
| **Volunteers** | Independent individuals who choose to participate in collection and distribution. |
| **Administrators** | Manage users, verification, and platform operations. |

**Important:** Volunteers are independent participants, not delivery partners. They decide whether to participate and independently coordinate their activities.

---

## 🛠️ Technology Stack

ResQMeal uses a modern web development stack.

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| TypeScript | Type safety and maintainable code |
| Vite | Frontend development and build tooling |
| Tailwind CSS | Responsive styling |
| Supabase | Backend services and database integration |
| PostgreSQL | Relational data storage |
| Authentication | User authentication and access management |
| Vercel | Web application deployment |

---

## 🏗️ Platform Architecture

ResQMeal follows a web-based architecture in which the frontend communicates with backend services to manage users, donations, claims, and distribution records.

```text
                  RESQMEAL PLATFORM
                         |
          +--------------+--------------+
          |              |              |
        Donors        Receivers      Volunteers
          |              |              |
          +--------------+--------------+
                         |
                  React Frontend
                         |
                  Supabase Services
                         |
              +----------+----------+
              |          |          |
          Database     Auth      Storage
              |
       Donation & Claim Records
              |
        Impact Calculation
              |
        Admin Dashboard
```

---

## 🚀 Getting Started

Follow these steps to run ResQMeal locally.

### Prerequisites

Make sure you have installed:

- Node.js (LTS recommended)
- npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ResQMeal.git
```

### 2. Navigate to the Project

```bash
cd ResQMeal
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root and configure your Supabase credentials.

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use your project's actual Supabase URL and publishable/anonymous key. Never expose your Supabase service-role key in frontend code.

### 5. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal to access ResQMeal.

### 6. Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 📈 Impact Measurement

ResQMeal aims to make food redistribution measurable rather than relying only on the number of donations created.

The platform uses the following estimated metrics:

| Metric | Calculation |
|---|---|
| Meals Saved | Verified distributed food (kg) ÷ 0.4 |
| Food Rescued | Total verified distributed food quantity |
| Emissions Avoided | Estimated using an emissions calculation model |

**Note:** These metrics are estimates, not independently verified environmental measurements. The meals-saved calculation assumes approximately 400 grams of food per meal. Emissions estimates depend on the methodology and emission factors used.

---

## ⚠️ Food Safety & Responsibility

ResQMeal is a coordination platform, not a food safety certification authority.

- ResQMeal does not inspect or certify donated food.
- ResQMeal does not guarantee the safety, quality, or suitability of donated food.
- Donors are responsible for the food they provide and its handling before collection.
- Receivers are responsible for assessing food before accepting and distributing it.
- All participants must follow applicable food safety, storage, transportation, and handling requirements.

The platform facilitates connections and coordination but does not replace responsible food handling practices.

---

## 🎯 Initial Pilot

**Launch Area:** Mathura, Uttar Pradesh, India.

ResQMeal is initially designed around a local food rescue ecosystem, with the potential to expand to other cities and communities.

The pilot focuses on building connections between local food businesses, NGOs, community kitchens, and independent volunteers.

---

## 🔮 Future Roadmap

Our vision is to develop ResQMeal into a scalable food rescue ecosystem.

Planned improvements include:

- [ ] Location-based donation discovery and matching.
- [ ] Real-time notifications for new donations and claims.
- [ ] Advanced analytics and impact reporting.
- [ ] Automated receiver-donor matching.
- [ ] Improved volunteer coordination.
- [ ] Digital food rescue and distribution reports.
- [ ] Expansion to multiple cities.
- [ ] Partnerships with restaurants, NGOs, and local organizations.

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

If you would like to contribute:

1. Fork the repository.
2. Create a new feature branch.
3. Make your changes.
4. Test your implementation.
5. Submit a Pull Request describing your changes.

Please ensure your contributions follow the existing project structure and coding conventions.

---

## 📄 License

A license has not yet been specified. Please check the repository for licensing information before using, modifying, or redistributing the project.

---

## ❤️ Our Mission

Food should feed people, not become waste.

ResQMeal aims to make food redistribution easier, more transparent, and more accessible by bringing the right people together at the right time.

**Every meal rescued is a step towards a more sustainable and hunger-free community.**

---

*Built with ❤️ for a better tomorrow.*

**ResQMeal – Rescue Food. Share Hope.**
