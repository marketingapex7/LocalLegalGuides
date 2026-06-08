const makeAvailableSponsorPackage = (coverageLabel) => ({
  status: "available",
  termLabel: "12-month exclusive package",
  coverageLabel,
  sponsor: {
    firmName: "",
    attorneyName: "",
    phone: "",
    ctaUrl: "",
    officeAddress: "",
    serviceArea: "",
    shortBio: "",
    photoUrl: "",
    disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
  },
});

const expansionSponsorPackages = Object.fromEntries(
  [
    ["st-clair-county-core-il", "5 Illinois city pages for one selected practice area"],
    ["jefferson-county-gateway-mo", "5 Missouri city pages for one selected practice area"],
    ["south-county-mo", "5 Missouri city pages for one selected practice area"],
    ["north-county-mo", "5 Missouri city pages for one selected practice area"],
    ["mid-county-clayton-corridor-mo", "5 Missouri city pages for one selected practice area"],
    ["franklin-county-i44-mo", "5 Missouri city pages for one selected practice area"],
    ["lincoln-county-growth-corridor-mo", "5 Missouri city pages for one selected practice area"],
    ["boone-county-columbia-mo", "5 Missouri city pages for one selected practice area"],
    ["springfield-suburban-ring-mo", "5 Missouri city pages for one selected practice area"],
    ["kansas-city-northland-mo", "5 Missouri city pages for one selected practice area"],
    ["guilford-county-triad-nc", "5 North Carolina DWI city pages"],
    ["new-hanover-coastal-nc", "5 North Carolina DWI city pages"],
    ["eastern-jackson-county-mo", "5 Missouri DWI city pages"],
    ["jasper-county-joplin-mo", "5 Missouri DWI city pages"],
    ["cabarrus-county-nc", "5 North Carolina DWI city pages"],
    ["durham-orange-triangle-nc", "4 North Carolina DWI city pages"],
  ].map(([slug, coverageLabel]) => [slug, makeAvailableSponsorPackage(coverageLabel)])
);

const moDorLocator = "https://dor.mo.gov/license-office-locator/";
const ilFacilityFinder = "https://www.ilsos.gov/departments/drivers/facilities/home.html";
const confirmHours = "Confirm current hours and available services with the agency before visiting.";

const office = ({ name, type, address, phone, hours, courtSystem, href, note }) => ({
  name,
  type,
  address,
  phone,
  hours,
  courtSystem,
  href,
  note,
});

const police = (name, address, phone, href, note, type = "Municipal Police") =>
  office({ name, type, address, phone, href, note });

const city = ({
  slug,
  name,
  agency,
  police: cityPolice,
  courtOverride,
  personalInjuryCourtOverride,
  licenseOfficeOverride,
  dui_local_data,
  duiLocalData,
}) => ({
  slug,
  name,
  agency,
  police: cityPolice,
  courtOverride,
  personalInjuryCourtOverride,
  licenseOfficeOverride,
  dui_local_data,
  duiLocalData,
});

const jurisdiction = (agency, role, notes) => ({ agency, role, notes });

const duiData = ({
  summary,
  sourceName,
  sourceUrl,
  sourceDate,
  campaigns = [],
  arrestSummary,
  arrestYear,
  arrestSourceName,
  arrestSourceUrl,
  crashSummary,
  crashSourceName,
  crashSourceUrl,
  roads = [],
  jurisdictions = [],
  note,
}) => ({
  enforcement_snapshot: summary
    ? {
        summary,
        source_name: sourceName,
        source_url: sourceUrl,
        source_date: sourceDate,
      }
    : undefined,
  past_campaigns: campaigns,
  arrest_data: arrestSummary
    ? {
        city_level_available: Boolean(arrestYear),
        summary: arrestSummary,
        year: arrestYear,
        source_name: arrestSourceName ?? sourceName,
        source_url: arrestSourceUrl ?? sourceUrl,
      }
    : undefined,
  crash_context: crashSummary
    ? {
        summary: crashSummary,
        source_name: crashSourceName,
        source_url: crashSourceUrl,
      }
    : undefined,
  local_roads: roads,
  jurisdiction_notes: jurisdictions,
  data_availability_note:
    note ??
    "City-level DUI arrest data is not published consistently across every police department. This guide uses local campaign results, official annual reports, and county/state context when city-level data is unavailable.",
});

const stLouisCountyCourt = office({
  name: "St. Louis County Circuit Court",
  address: "105 S. Central Avenue, Clayton, MO 63105",
  phone: "(314) 615-8029",
  hours: "Monday-Friday, 8:00 am-5:00 pm",
  courtSystem: "21st Judicial Circuit",
  href: "https://stlcountycourts.com/",
});

const clayCountyCourt = office({
  name: "Clay County Circuit Court",
  address: "11 S. Water Street, Liberty, MO 64068",
  phone: "(816) 407-3900",
  hours: "Confirm current hours with the circuit clerk before visiting.",
  courtSystem: "7th Judicial Circuit",
  href: "https://www.courts.mo.gov/page.jsp?id=99494",
});

const platteCountyCourt = office({
  name: "Platte County Circuit Court",
  address: "415 Third Street, Platte City, MO 64079",
  phone: "(816) 858-2232",
  hours: "Confirm current hours with the circuit clerk before visiting.",
  courtSystem: "6th Judicial Circuit",
  href: "https://www.courts.mo.gov/page.jsp?id=99493",
});

const christianCountyCourt = office({
  name: "Christian County Circuit Court",
  address: "110 W. Elm Street, Ozark, MO 65721",
  phone: "(417) 582-5120",
  hours: "Confirm current hours with the circuit clerk before visiting.",
  courtSystem: "38th Judicial Circuit",
  href: "https://www.courts.mo.gov/page.jsp?id=124650",
});

const greeneCountyCourt = office({
  name: "Greene County Circuit Court",
  address: "1010 N. Boonville Avenue, Springfield, MO 65802",
  phone: "(417) 868-4074",
  hours: "Confirm current hours with the circuit clerk before visiting.",
  courtSystem: "31st Judicial Circuit",
  href: "https://www.courts.mo.gov/page.jsp?id=124636",
});

const guilfordCountyCourt = office({
  name: "Guilford County Courthouse",
  address: "201 S. Eugene Street, Greensboro, NC 27401",
  phone: "(336) 412-7300",
  hours: "Monday-Friday, 8:30 am-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - Guilford County",
  href: "https://www.nccourts.gov/locations/guilford-county",
});

const guilfordHighPointCourt = office({
  name: "Guilford County Courthouse - High Point",
  address: "505 E. Green Drive, High Point, NC 27262",
  phone: "(336) 822-6700",
  hours: "Monday-Friday, 8:30 am-12:45 pm and 1:45 pm-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - Guilford County",
  href: "https://www.nccourts.gov/locations/guilford-county/guilford-county-courthouse-high-point",
});

const newHanoverCountyCourt = office({
  name: "New Hanover County Courthouse",
  address: "316 Princess Street, Wilmington, NC 28401",
  phone: "(910) 772-6600",
  hours: "Monday-Friday, 8:00 am-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - New Hanover County",
  href: "https://www.nccourts.gov/locations/new-hanover-county/new-hanover-county-courthouse",
});

const cabarrusCountyCourt = office({
  name: "Cabarrus County Courthouse",
  address: "61 Union Street S, Concord, NC 28025",
  phone: "(704) 262-5500",
  hours: "Monday-Friday, 8:00 am-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - Cabarrus County",
  href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse",
});

const durhamCountyCourt = office({
  name: "Durham County Courthouse",
  address: "510 S. Dillard Street, Durham, NC 27701",
  phone: "(919) 808-3000",
  hours: "Monday-Friday, 8:30 am-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - Durham County",
  href: "https://www.nccourts.gov/locations/durham-county/durham-county-courthouse",
});

const orangeCountyCourt = office({
  name: "Orange County Courthouse",
  address: "106 E. Margaret Lane, Hillsborough, NC 27278",
  phone: "(919) 644-4500",
  hours: "Monday-Friday, 8:30 am-5:00 pm; confirm current courthouse hours before visiting.",
  courtSystem: "North Carolina Judicial Branch - Orange County",
  href: "https://www.nccourts.gov/locations/orange-county/orange-county-courthouse",
});

const easternJacksonCountyCourt = office({
  name: "Eastern Jackson County Courthouse",
  address: "308 W. Kansas Avenue, Independence, MO 64050",
  phone: "(816) 881-1619",
  hours: "Confirm current hours with the 16th Judicial Circuit before visiting.",
  courtSystem: "16th Judicial Circuit Court of Jackson County",
  href: "https://www.16thcircuit.org/",
});

const jasperCountyCourt = office({
  name: "Jasper County Circuit Court",
  address: "302 S. Main Street, Carthage, MO 64836",
  phone: "(417) 358-0441",
  hours: "Monday-Friday, 8:30 am-4:30 pm, with a midday lunch closure; confirm current hours before visiting.",
  courtSystem: "29th Judicial Circuit Court",
  href: "https://jaspercountycourts.org/",
});

const jasperJoplinCourt = office({
  name: "Jasper County Courts Building - Joplin",
  address: "633 S. Pearl Avenue, Joplin, MO 64801",
  phone: "(417) 625-4310",
  hours: "Monday-Friday, 8:30 am-4:30 pm, with a midday lunch closure; confirm current hours before visiting.",
  courtSystem: "29th Judicial Circuit Court",
  href: "https://jaspercountycourts.org/contact-us",
});

const stLouisCountyLicense = office({
  name: "Missouri Department of Revenue License Office Locator",
  type: "Missouri License Office Locator",
  address: "Use the Missouri DOR locator for the nearest current office.",
  phone: "(573) 526-2407",
  hours: confirmHours,
  href: moDorLocator,
  note: "Missouri license-office locations and hours can change; use the official DOR locator before visiting.",
});

const expansionRegions = [
  {
    slug: "st-clair-county-core-il",
    name: "St. Clair County Core",
    state: "Illinois",
    stateCode: "IL",
    teaser: "Belleville, O'Fallon, and nearby Metro East city guides tied to St. Clair County court and agency records.",
    urgentDeadline: {
      headline: "St. Clair County cases move through a county court system, even when the stop or crash starts locally.",
      body: "Readers should identify the police agency first, then verify the court date, records office, and Secretary of State license track separately.",
    },
    regionHighlights: [
      {
        title: "Belleville anchors the courthouse market",
        body: "Belleville gives this cluster county-seat relevance while O'Fallon, Fairview Heights, Shiloh, and Swansea add suburban search intent.",
      },
      {
        title: "Metro East traffic corridors matter",
        body: "I-64, Illinois Route 159, Green Mount Road, and nearby commercial corridors create practical DUI, crash-report, and injury-document questions.",
      },
      {
        title: "Useful for DUI and PI sponsors",
        body: "The cluster is dense enough for attorney outreach while still being more targeted than a broad Metro East or St. Louis campaign.",
      },
    ],
    processNotes: [
      {
        label: "Local stop",
        title: "Start with the agency named on the paperwork",
        body: "A Belleville, O'Fallon, Fairview Heights, Shiloh, Swansea, county, or state-police contact can change where records requests begin.",
      },
      {
        label: "County court",
        title: "Court records point back to Belleville",
        body: "DUI and civil filings tied to this cluster usually require checking the St. Clair County court system rather than only a city office.",
      },
      {
        label: "License track",
        title: "Illinois Secretary of State issues are separate",
        body: "Driver-license questions should be confirmed through Secretary of State resources, not assumed from the criminal case alone.",
      },
    ],
    court: office({
      name: "St. Clair County Courthouse",
      address: "10 Public Square, Belleville, IL 62220",
      phone: "(618) 277-6600",
      hours: "Monday-Friday, 8:30 am-4:30 pm",
      courtSystem: "20th Judicial Circuit",
      href: "https://www.illinoiscourts.gov/courts-directory/109/St-Clair-County-Courthouse/court/",
    }),
    licenseOffice: office({
      name: "Illinois Secretary of State Driver Services Facility - Belleville",
      type: "Driver Services",
      address: "400 W. Main Street, Belleville, IL 62220",
      phone: "(618) 236-8750",
      hours: confirmHours,
      href: ilFacilityFinder,
      note: "Use the Illinois Secretary of State facility finder to verify appointments, services, and current hours.",
    }),
    sharedEnforcement: [
      police(
        "St. Clair County Sheriff's Department",
        "700 N. 5th Street, Belleville, IL 62220",
        "(618) 277-3505",
        "https://www.stclaircountyil.gov/departments/sheriff",
        "County enforcement and records source for incidents handled outside city-police jurisdiction.",
        "County Sheriff"
      ),
    ],
    cities: [
      city({
        slug: "belleville-il",
        name: "Belleville",
        agency: "Belleville Police Department",
        police: police("Belleville Police Department", "720 W. Main Street, Belleville, IL 62220", "(618) 234-1212", "https://www.belleville.net/355/Police", "For Belleville police reports, crash records, and local enforcement questions."),
        local_context_intro:
          "This guide focuses on DUI cases connected to Belleville and nearby St. Clair County communities, including stops or records involving Belleville Police, the St. Clair County Sheriff's Department, or Illinois State Police around Illinois Route 15, Illinois Route 159, Illinois Route 161, Illinois Route 13, I-64, downtown Belleville, and the Public Square courthouse area.",
        common_roads: ["Illinois Route 15", "Illinois Route 159", "Illinois Route 161", "Illinois Route 13", "I-64", "downtown Belleville", "Public Square"],
      }),
      city({
        slug: "ofallon-il",
        name: "O'Fallon",
        agency: "O'Fallon Police Department",
        police: police("O'Fallon Police Department", "285 N. Seven Hills Road, O'Fallon, IL 62269", "(618) 624-4545", "https://www.ofallon.org/253/Police", "For O'Fallon police records, traffic crash reports, and local enforcement questions."),
      }),
      city({
        slug: "fairview-heights-il",
        name: "Fairview Heights",
        agency: "Fairview Heights Police Department",
        police: police("Fairview Heights Police Department", "10027 Bunkum Road, Fairview Heights, IL 62208", "(618) 489-2100", "https://fhpd.org/contact-us/", "For Fairview Heights police reports, crash records, and local enforcement questions."),
      }),
      city({
        slug: "shiloh-il",
        name: "Shiloh",
        agency: "Shiloh Police Department",
        police: police("Shiloh Police Department", "3498 Lebanon Avenue, Shiloh, IL 62221", "(618) 632-9047", "https://shilohil.org/village-hall/police-department/", "For Shiloh records, police reports, and local enforcement questions."),
      }),
      city({
        slug: "swansea-il",
        name: "Swansea",
        agency: "Swansea Police Department",
        police: police("Swansea Police Department", "1400 N. Illinois Street, Swansea, IL 62226", "(618) 233-8114", "https://www.swanseail.org/1086/Police-Department", "For Swansea police reports, crash records, and local enforcement questions."),
      }),
    ],
  },
  {
    slug: "jefferson-county-gateway-mo",
    name: "Jefferson County Gateway",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Arnold, Festus, Crystal City, Herculaneum, and Hillsboro guides built around Jefferson County court and commuter corridors.",
    urgentDeadline: {
      headline: "Jefferson County DWI and crash questions often begin on local roads and end at the county courthouse.",
      body: "Drivers and injury claimants should keep the ticket, report number, agency name, court notice, and insurance paperwork together.",
    },
    regionHighlights: [
      { title: "Highway-driven legal intent", body: "I-55, Highway 67, and county commuter traffic make this a strong DUI-first territory with a real injury-claim angle." },
      { title: "Hillsboro creates the courthouse anchor", body: "The county-seat page connects the city pages to Jefferson County court records instead of treating each suburb as isolated." },
      { title: "Good founding sponsor fit", body: "The cluster is specific enough for a local attorney to own without competing for a broad St. Louis keyword." },
    ],
    processNotes: [
      { label: "Agency first", title: "Confirm who handled the stop or crash", body: "Arnold, Festus, Crystal City, Herculaneum, Hillsboro, county deputies, and Missouri State Highway Patrol may all appear in records." },
      { label: "County filing", title: "Court questions generally route through Jefferson County", body: "DWI, traffic, and civil filings should be checked through the circuit court or the notice on the paperwork." },
      { label: "License issue", title: "Missouri DOR runs a separate administrative process", body: "A DWI arrest can create license deadlines apart from what happens in the criminal case." },
    ],
    court: office({
      name: "Jefferson County Circuit Court",
      address: "300 Main Street, Hillsboro, MO 63050",
      phone: "(636) 797-5443",
      hours: "Confirm current hours with the circuit clerk before visiting.",
      courtSystem: "23rd Judicial Circuit",
      href: "https://www.courts.mo.gov/page.jsp?id=124615",
    }),
    licenseOffice: office({
      name: "Arnold License Office",
      type: "Missouri License Office",
      address: "3540 Jeffco Boulevard, Suite 120, Arnold, MO 63010",
      phone: "(636) 461-0846",
      hours: confirmHours,
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm office services and current hours.",
    }),
    sharedEnforcement: [
      police("Jefferson County Sheriff's Office", "400 First Street, Hillsboro, MO 63050", "(636) 797-5000", "https://www.jeffcomo.org/209/Sheriff", "County records source for incidents handled by Jefferson County deputies.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "arnold-mo", name: "Arnold", agency: "Arnold Police Department", police: police("Arnold Police Department", "2101 Jeffco Boulevard, Arnold, MO 63010", "(636) 296-3204", "https://www.arnoldmo.org/government/police/", "For Arnold police reports, crash records, and local enforcement questions.") }),
      city({ slug: "festus-mo", name: "Festus", agency: "Festus Police Department", police: police("Festus Police Department", "100 Park Avenue, Festus, MO 63028", "(636) 937-3646", "https://www.festusmo.gov/180/Police", "For Festus police reports, crash records, and local enforcement questions.") }),
      city({ slug: "crystal-city-mo", name: "Crystal City", agency: "Crystal City Police Department", police: police("Crystal City Police Department", "130 Mississippi Avenue, Crystal City, MO 63019", "(636) 937-4601", "https://www.crystalcitymo.org/", "For Crystal City records and local police-report questions, verify the current department contact before visiting.") }),
      city({ slug: "herculaneum-mo", name: "Herculaneum", agency: "Herculaneum Police Department", police: police("Herculaneum Police Department", "1 Parkwood Court, Herculaneum, MO 63048", "(636) 479-4791", "https://www.cityofherculaneum.org/", "For Herculaneum police reports, crash records, and local enforcement questions.") }),
      city({ slug: "hillsboro-mo", name: "Hillsboro", agency: "Hillsboro Police Department", police: police("Hillsboro Police Department", "101 Main Street, Hillsboro, MO 63050", "(636) 797-5229", "https://www.hillsboromo.org/", "For Hillsboro police and county-seat records questions, confirm the current records contact before visiting.") }),
    ],
  },
  {
    slug: "south-county-mo",
    name: "South County",
    state: "Missouri",
    stateCode: "MO",
    teaser: "South St. Louis County guides for Mehlville, Oakville, Affton, Lemay, and Concord.",
    urgentDeadline: {
      headline: "South County legal questions often depend on which county precinct handled the incident.",
      body: "Many communities in this cluster are unincorporated, so county police precinct contacts can matter more than a city hall listing.",
    },
    regionHighlights: [
      { title: "Avoids overbroad St. Louis targeting", body: "The cluster gives attorneys South County visibility without trying to rank a generic St. Louis lawyer page first." },
      { title: "Precinct-based records are important", body: "Readers need practical guidance on South County and Affton-Southwest police contacts, not just courthouse information." },
      { title: "DUI and PI both fit", body: "I-55, Lindbergh, Telegraph, Gravois, and Lemay Ferry create both traffic-stop and crash-report search intent." },
    ],
    processNotes: [
      { label: "County precincts", title: "Unincorporated communities need precinct-specific guidance", body: "South County readers may need St. Louis County Police records rather than a municipal police department." },
      { label: "Clayton court", title: "The court layer points back to Clayton", body: "Criminal and civil case information usually ties into the St. Louis County Circuit Court system." },
      { label: "Local documents", title: "Report numbers and agency names matter", body: "For PI and DWI pages, the first practical step is identifying the report source before calling the wrong office." },
    ],
    court: stLouisCountyCourt,
    licenseOffice: stLouisCountyLicense,
    sharedEnforcement: [
      police("St. Louis County Police Department - South County Precinct", "323 Sappington Barracks Road, St. Louis, MO 63125", "(314) 615-0162", "https://www.stlouiscountypolice.com/precincts/south-county-precinct/", "County precinct serving areas of unincorporated South St. Louis County.", "County Police"),
      police("St. Louis County Police Department - Affton Southwest Precinct", "11500 Gravois Road, St. Louis, MO 63126", "(314) 638-5550", "https://stlouiscountypolice.com/precincts/affton-southwest/", "County precinct serving Affton and surrounding southwest county communities.", "County Police"),
    ],
    cities: [
      city({ slug: "mehlville-mo", name: "Mehlville", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - South County Precinct", "323 Sappington Barracks Road, St. Louis, MO 63125", "(314) 615-0162", "https://www.stlouiscountypolice.com/precincts/south-county-precinct/", "Mehlville is served through county-police coverage rather than a standalone municipal police department.", "County Police") }),
      city({ slug: "oakville-mo", name: "Oakville", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - South County Precinct", "323 Sappington Barracks Road, St. Louis, MO 63125", "(314) 615-0162", "https://www.stlouiscountypolice.com/precincts/south-county-precinct/", "Oakville police-report questions generally begin with the South County Precinct.", "County Police") }),
      city({ slug: "affton-mo", name: "Affton", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - Affton Southwest Precinct", "11500 Gravois Road, St. Louis, MO 63126", "(314) 638-5550", "https://stlouiscountypolice.com/precincts/affton-southwest/", "Affton is served by St. Louis County Police through the Affton-Southwest Precinct.", "County Police") }),
      city({ slug: "lemay-mo", name: "Lemay", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - South County Precinct", "323 Sappington Barracks Road, St. Louis, MO 63125", "(314) 615-0162", "https://www.stlouiscountypolice.com/precincts/south-county-precinct/", "Lemay readers should confirm whether South County Precinct or another agency handled the report.", "County Police") }),
      city({ slug: "concord-mo", name: "Concord", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - South County Precinct", "323 Sappington Barracks Road, St. Louis, MO 63125", "(314) 615-0162", "https://www.stlouiscountypolice.com/precincts/south-county-precinct/", "Concord police-report questions usually begin with St. Louis County Police.", "County Police") }),
    ],
  },
  {
    slug: "north-county-mo",
    name: "North County",
    state: "Missouri",
    stateCode: "MO",
    teaser: "North St. Louis County guides for Florissant, Hazelwood, Bridgeton, Spanish Lake, and Black Jack.",
    urgentDeadline: {
      headline: "North County pages need city-police and county-precinct distinctions.",
      body: "Florissant, Hazelwood, and Bridgeton have municipal departments, while Spanish Lake and Black Jack route many questions through county police.",
    },
    regionHighlights: [
      { title: "Recognizable local territory", body: "North County is a real service area with enough search intent for DUI-first and PI-follow-up sponsorships." },
      { title: "County court connection", body: "The cluster keeps the Clayton court path visible while still making each city page locally useful." },
      { title: "Agency split is the value", body: "Clear police-contact differences help the pages answer practical user questions instead of reading like generic SEO pages." },
    ],
    processNotes: [
      { label: "Municipal or county", title: "Check the agency before requesting records", body: "A Florissant or Hazelwood report is not requested the same way as a Spanish Lake or Black Jack county-police report." },
      { label: "Court path", title: "Court notices still matter more than assumptions", body: "Use the ticket, summons, or civil filing notice to confirm which division or court date applies." },
      { label: "Sponsor value", title: "A sponsor gets a coherent territory", body: "The package is narrow enough for North County outreach while still covering five distinct local pages." },
    ],
    court: stLouisCountyCourt,
    licenseOffice: stLouisCountyLicense,
    sharedEnforcement: [
      police("St. Louis County Police Department - North County Precinct", "2225 Dunn Road, St. Louis, MO 63136", "(314) 615-4297", "https://www.stlouiscountypolice.com/precincts/north-county-precinct/", "County precinct serving Spanish Lake, Black Jack, and other unincorporated North County areas.", "County Police"),
    ],
    cities: [
      city({ slug: "florissant-mo", name: "Florissant", agency: "Florissant Police Department", police: police("Florissant Police Department", "1700 N. Highway 67, Florissant, MO 63033", "(314) 831-7000", "https://www.florissantmo.com/egov/apps/locations/facilities.egov?id=8&view=detail", "For Florissant police reports, crash records, and local enforcement questions.") }),
      city({ slug: "hazelwood-mo", name: "Hazelwood", agency: "Hazelwood Police Department", police: police("Hazelwood Police Department", "415 Elm Grove Lane, Hazelwood, MO 63042", "(314) 838-5000", "https://www.hazelwoodmo.org/220/Office-of-the-Chief-of-Police", "For Hazelwood police reports, crash records, and local enforcement questions.") }),
      city({ slug: "bridgeton-mo", name: "Bridgeton", agency: "Bridgeton Police Department", police: police("Bridgeton Police Department", "12355 Natural Bridge Road, Bridgeton, MO 63044", "(314) 739-7557", "https://www.bridgetonmo.com/396/Police", "For Bridgeton police reports, crash records, and local enforcement questions.") }),
      city({ slug: "spanish-lake-mo", name: "Spanish Lake", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - North County Precinct", "2225 Dunn Road, St. Louis, MO 63136", "(314) 615-4297", "https://www.stlouiscountypolice.com/precincts/north-county-precinct/", "Spanish Lake police-report questions generally begin with the North County Precinct.", "County Police") }),
      city({ slug: "black-jack-mo", name: "Black Jack", agency: "St. Louis County Police Department", police: police("St. Louis County Police Department - North County Precinct", "2225 Dunn Road, St. Louis, MO 63136", "(314) 615-4297", "https://www.stlouiscountypolice.com/precincts/north-county-precinct/", "Black Jack is listed by St. Louis County Police as part of the North County Precinct service area.", "County Police") }),
    ],
  },
  {
    slug: "mid-county-clayton-corridor-mo",
    name: "Mid County / Clayton Corridor",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Clayton-corridor guides for court-adjacent suburbs with strong personal injury and DWI local-process relevance.",
    urgentDeadline: {
      headline: "Clayton gives this cluster courthouse credibility, but each city still has its own records path.",
      body: "Readers should separate St. Louis County court information from municipal police or accident-report requests.",
    },
    regionHighlights: [
      { title: "Courthouse-adjacent territory", body: "Clayton is the county legal hub, making this a high-credibility cluster for PI-first sponsorship sales." },
      { title: "Dense suburban search intent", body: "University City, Maplewood, Richmond Heights, and Brentwood add compact local pages around major commuter roads." },
      { title: "Strong attorney fit", body: "A sponsor can present as local to the court corridor rather than buying a broad St. Louis ad placement." },
    ],
    processNotes: [
      { label: "Court hub", title: "County court access is the organizing idea", body: "The cluster should frame Clayton as the legal hub while city pages handle police records and local incident details." },
      { label: "PI priority", title: "Injury claims benefit from records clarity", body: "Crash reports, medical records, insurer letters, and lawsuit deadlines should be gathered early." },
      { label: "DWI fit", title: "DWI pages still matter", body: "Traffic stops on I-64, I-170, Hanley, Brentwood, Manchester, and Delmar can create local DWI search demand." },
    ],
    court: stLouisCountyCourt,
    licenseOffice: stLouisCountyLicense,
    cities: [
      city({ slug: "clayton-mo", name: "Clayton", agency: "Clayton Police Department", police: police("Clayton Police Department", "10 S. Brentwood Boulevard, Clayton, MO 63105", "(314) 645-3000", "https://www.claytonmo.gov/police", "For Clayton police reports, crash records, and court-corridor enforcement questions."), dui_local_data: duiData({ summary: "The Clayton Police Department publishes annual reports covering crime statistics, budget, organizational structure, internal investigations, use-of-force data, and other department performance indicators.", sourceName: "Clayton Police Department 2024 Annual Report", sourceUrl: "https://www.claytonmo.gov/government/police/clayton-police-department-2020-annual-report", sourceDate: "2024", roads: ["I-64", "I-170", "S. Brentwood Boulevard", "Forsyth Boulevard", "Hanley Road"], jurisdictions: [jurisdiction("Clayton Police Department", "Municipal police", "Handles city traffic stops and crash reports in Clayton."), jurisdiction("St. Louis County Police Department", "County police", "May be involved in regional or nearby county enforcement."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement and crash investigations.")] }) }),
      city({ slug: "university-city-mo", name: "University City", agency: "University City Police Department", police: police("University City Police Department", "6801 Delmar Boulevard, University City, MO 63130", "(314) 725-2211", "https://www.ucitymo.org/78/Police-Department", "For University City police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "University City publishes annual reports and police crime-statistics pages that link to official NIBRS crime data resources for the department.", sourceName: "University City Police crime statistics", sourceUrl: "https://www.ucitymo.org/482/Crime-Statistics", roads: ["Delmar Boulevard", "Olive Boulevard", "I-170", "Skinker Boulevard", "Big Bend Boulevard"], jurisdictions: [jurisdiction("University City Police Department", "Municipal police", "Handles city traffic stops, incident reports, and crash records."), jurisdiction("St. Louis County Police Department", "County police", "May be involved in nearby county areas or mutual-aid situations."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
      city({ slug: "maplewood-mo", name: "Maplewood", agency: "Maplewood Police Department", police: police("Maplewood Police Department", "7601 Manchester Road, Maplewood, MO 63143", "(314) 645-4880", "https://www.cityofmaplewood.com/", "For Maplewood records and police-report questions, confirm the current records contact before visiting.") }),
      city({ slug: "richmond-heights-mo", name: "Richmond Heights", agency: "Richmond Heights Police Department", police: police("Richmond Heights Police Department", "7447 Dale Avenue, Richmond Heights, MO 63117", "(314) 655-3630", "https://rhpolice.org/contact-us/general-contact-information/", "For Richmond Heights police reports, crash records, and local enforcement questions.") }),
      city({ slug: "brentwood-mo", name: "Brentwood", agency: "Brentwood Police Department", police: police("Brentwood Police Department", "272 Hanley Industrial Court, Brentwood, MO 63144", "(314) 644-7100", "https://brentwoodmo.org/13/Police", "For Brentwood police reports, crash records, and local enforcement questions.") }),
    ],
  },
  {
    slug: "franklin-county-i44-mo",
    name: "Franklin County / I-44 Corridor",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Washington, Union, Pacific, Sullivan, and St. Clair guides built around Franklin County and I-44 traffic.",
    urgentDeadline: {
      headline: "Franklin County's I-44 corridor creates practical DWI, traffic, and crash-document questions.",
      body: "Union provides the county-court anchor while the city pages identify local police and records contacts.",
    },
    regionHighlights: [
      { title: "Clean county identity", body: "The territory has a clear courthouse, county identity, and highway-corridor story." },
      { title: "DUI-first sponsor target", body: "I-44, Highway 100, and Highway 47 make DWI and traffic-defense outreach especially natural." },
      { title: "PI is still useful", body: "Crash-report and insurance-document sections let the same cluster support injury sponsorships as the market grows." },
    ],
    processNotes: [
      { label: "I-44 corridor", title: "Highway stops and crashes can involve multiple agencies", body: "City police, Franklin County deputies, and Missouri State Highway Patrol may all appear in paperwork." },
      { label: "Union court", title: "County court questions point toward Union", body: "Use official court notices and Case.net-linked resources for current case information." },
      { label: "License documents", title: "DOR issues stay separate", body: "A DWI license suspension or reinstatement issue should be checked through Missouri DOR sources." },
    ],
    court: office({
      name: "Franklin County Circuit Court",
      address: "401 E. Main Street, Union, MO 63084",
      phone: "(636) 583-7365",
      hours: "Confirm current hours with the circuit clerk before visiting.",
      courtSystem: "20th Judicial Circuit",
      href: "https://www.courts.mo.gov/page.jsp?id=124614",
    }),
    licenseOffice: office({
      name: "Union License Office",
      type: "Missouri License Office",
      address: "105 S. Oak Street, Union, MO 63084",
      phone: "(636) 583-3282",
      hours: "Monday-Friday, 8:30 am-4:30 pm; confirm before visiting.",
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm current services and hours.",
    }),
    sharedEnforcement: [
      police("Franklin County Sheriff's Office", "1 Bruns Lane, Union, MO 63084", "(636) 583-2560", "https://www.franklinmo.org/sheriff", "County records source for incidents handled by Franklin County deputies.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "washington-mo", name: "Washington", agency: "Washington Police Department", police: police("Washington Police Department", "301 Jefferson Street, Washington, MO 63090", "(636) 390-1050", "https://washmo.gov/", "For Washington police reports, crash records, and local enforcement questions.") }),
      city({ slug: "union-mo", name: "Union", agency: "Union Police Department", police: police("Union Police Department", "119 S. Church Street, Union, MO 63084", "(636) 583-3700", "https://www.unionmissouri.gov/", "For Union police reports, crash records, and county-seat enforcement questions.") }),
      city({ slug: "pacific-mo", name: "Pacific", agency: "Pacific Police Department", police: police("Pacific Police Department", "300 Hoven Drive, Pacific, MO 63069", "(636) 257-2424", "https://www.pacificmissouri.com/", "For Pacific police reports, crash records, and local enforcement questions.") }),
      city({ slug: "sullivan-mo", name: "Sullivan", agency: "Sullivan Police Department", police: police("Sullivan Police Department", "106 Progress Drive, Sullivan, MO 63080", "(573) 468-8001", "https://www.sullivan.mo.us/", "For Sullivan police reports, crash records, and local enforcement questions.") }),
      city({ slug: "st-clair-mo", name: "St. Clair", agency: "St. Clair Police Department", police: police("St. Clair Police Department", "1 Paul Parks Drive, St. Clair, MO 63077", "(636) 629-1313", "https://stclairmo.us/", "For St. Clair police reports, crash records, and local enforcement questions.") }),
    ],
  },
  {
    slug: "lincoln-county-growth-corridor-mo",
    name: "Lincoln County Growth Corridor",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Troy, Moscow Mills, Winfield, Elsberry, and Hawk Point guides for a growing St. Louis-orbit county.",
    urgentDeadline: {
      headline: "Lincoln County is an early-growth legal territory with a clear courthouse anchor in Troy.",
      body: "The pages emphasize local police contacts, county-court routing, and license-document separation for DWI readers.",
    },
    regionHighlights: [
      { title: "Early sponsor territory", body: "Lincoln County is less competitive than St. Charles County but still close enough to the metro to interest growth-minded firms." },
      { title: "Troy anchors the cluster", body: "Troy gives the package a courthouse and attorney-market center while smaller city pages create local search reach." },
      { title: "DUI-first fit", body: "County roads and commuter movement make DWI and traffic-defense content the strongest first pitch." },
    ],
    processNotes: [
      { label: "County growth", title: "Smaller cities still need specific pages", body: "Moscow Mills, Winfield, Elsberry, and Hawk Point should not be treated as Troy-only searches." },
      { label: "Court path", title: "Court records route through Lincoln County", body: "DWI and civil filing questions should be checked through the circuit clerk or official court resources." },
      { label: "Records", title: "Confirm the exact agency before requesting a report", body: "Police, sheriff, and highway-patrol records can differ depending on where the incident happened." },
    ],
    court: office({
      name: "Lincoln County Circuit Court",
      address: "45 Business Park Drive, Troy, MO 63379",
      phone: "(636) 528-6300",
      hours: "Confirm current hours with the circuit clerk before visiting.",
      courtSystem: "45th Judicial Circuit",
      href: "https://www.courts.mo.gov/page.jsp?id=124796",
    }),
    licenseOffice: office({
      name: "Troy License Office",
      type: "Missouri License Office",
      address: "850 E. Cherry Street, Troy, MO 63379",
      phone: "(636) 622-7090",
      hours: confirmHours,
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm current services and hours.",
    }),
    sharedEnforcement: [
      police("Lincoln County Sheriff's Office", "65 Business Park Drive, Troy, MO 63379", "(636) 528-8546", "https://lcsomo.gov/", "County records source for incidents handled by Lincoln County deputies.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "troy-mo", name: "Troy", agency: "Troy Police Department", police: police("Troy Police Department", "800 Cap Au Gris Street, Troy, MO 63379", "(636) 528-4725", "https://www.cityoftroymissouri.com/", "For Troy police reports, crash records, and county-seat enforcement questions.") }),
      city({ slug: "moscow-mills-mo", name: "Moscow Mills", agency: "Moscow Mills Police Department", police: police("Moscow Mills Police Department", "500 Highway MM, Moscow Mills, MO 63362", "(636) 356-4612", "https://moscowmillsmo.com/", "For Moscow Mills police reports and local records, confirm the current records contact before visiting.") }),
      city({ slug: "winfield-mo", name: "Winfield", agency: "Winfield Police Department", police: police("Winfield Police Department", "51 Harry's Way, Winfield, MO 63389", "(636) 668-8100", "https://cityofwinfieldmo.com/", "For Winfield police reports and local records, confirm the current records contact before visiting.") }),
      city({ slug: "elsberry-mo", name: "Elsberry", agency: "Elsberry Police Department", police: police("Elsberry Police Department", "201 Broadway Street, Elsberry, MO 63343", "(573) 898-5456", "https://www.elsberrymo.org/", "For Elsberry police reports and local enforcement questions.") }),
      city({ slug: "hawk-point-mo", name: "Hawk Point", agency: "Hawk Point Police Department", police: police("Hawk Point Police Department", "161 W. Lincoln Street, Hawk Point, MO 63349", "(636) 338-4377", "https://hawkpointmo.com/", "For Hawk Point police reports and local records, confirm the current records contact before visiting.") }),
    ],
  },
  {
    slug: "boone-county-columbia-mo",
    name: "Columbia / Boone County",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Columbia and Boone County community guides with college-town, courthouse, DWI, and injury-claim relevance.",
    urgentDeadline: {
      headline: "Columbia's legal market combines city enforcement, Boone County courts, and university-area traffic.",
      body: "Readers should identify whether Columbia Police, Boone County deputies, campus police, or another agency generated the paperwork.",
    },
    regionHighlights: [
      { title: "Strong city identity", body: "Columbia is large enough to carry search demand while still being more targeted than Kansas City or St. Louis." },
      { title: "DUI-first college-town angle", body: "University-area traffic, nightlife, and local enforcement make DWI content a natural starting point." },
      { title: "PI pages add durable value", body: "Crash reports, medical documentation, and insurance steps help the pages serve injury searches beyond criminal-defense intent." },
    ],
    processNotes: [
      { label: "Agency mix", title: "Columbia-area records can start with different agencies", body: "City police, county deputies, and university-area agencies can each create different report paths." },
      { label: "Boone court", title: "Boone County court is the central court layer", body: "Court dates and civil filings should be verified through the 13th Judicial Circuit or official notices." },
      { label: "Documentation", title: "Students and commuters both need paperwork clarity", body: "The pages should make report, citation, medical, insurer, and license documents easy to gather." },
    ],
    court: office({
      name: "Boone County Circuit Court",
      address: "705 E. Walnut Street, Columbia, MO 65201",
      phone: "(573) 886-4000",
      hours: "Monday-Friday, 8:00 am-5:00 pm",
      courtSystem: "13th Judicial Circuit",
      href: "https://www.courts.mo.gov/hosted/circuit13/other/contact.htm",
    }),
    licenseOffice: office({
      name: "Columbia License Office",
      type: "Missouri License Office",
      address: "403 Vandiver Drive, Columbia, MO 65202",
      phone: "(573) 474-4700",
      hours: confirmHours,
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm current services and hours.",
    }),
    sharedEnforcement: [
      police("Boone County Sheriff's Office", "2121 County Drive, Columbia, MO 65202", "(573) 875-1111", "https://www.showmeboone.com/sheriff/", "County records source for incidents handled by Boone County deputies.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "columbia-mo", name: "Columbia", agency: "Columbia Police Department", police: police("Columbia Police Department", "600 E. Walnut Street, Columbia, MO 65201", "(573) 874-7652", "https://www.como.gov/police/", "For Columbia police reports, crash records, and local enforcement questions.") }),
      city({ slug: "ashland-mo", name: "Ashland", agency: "Ashland Police Department", police: police("Ashland Police Department", "109 E. Broadway, Ashland, MO 65010", "(573) 657-9062", "https://www.ashlandmo.us/", "For Ashland police reports, crash records, and local enforcement questions.") }),
      city({ slug: "hallsville-mo", name: "Hallsville", agency: "Hallsville Police Department", police: police("Hallsville Police Department", "202 Highway 124 E., Hallsville, MO 65255", "(573) 696-3838", "https://hallsvillemo.org/", "For Hallsville police reports and local enforcement questions.") }),
      city({ slug: "centralia-mo", name: "Centralia", agency: "Centralia Police Department", police: police("Centralia Police Department", "114 S. Rollins Street, Centralia, MO 65240", "(573) 682-2132", "https://www.centraliamo.org/", "For Centralia police reports, crash records, and local enforcement questions.") }),
      city({ slug: "rocheport-mo", name: "Rocheport", agency: "Boone County Sheriff's Office", police: police("Boone County Sheriff's Office", "2121 County Drive, Columbia, MO 65202", "(573) 875-1111", "https://www.showmeboone.com/sheriff/", "Rocheport readers should confirm whether Boone County deputies or another agency handled the report.", "County Sheriff") }),
    ],
  },
  {
    slug: "springfield-suburban-ring-mo",
    name: "Springfield Suburban Ring",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Nixa, Ozark, Republic, Willard, and Battlefield guides around the Springfield-area suburban ring.",
    urgentDeadline: {
      headline: "This cluster crosses Christian and Greene counties, so the correct court depends on the city.",
      body: "Nixa and Ozark point toward Christian County, while Republic, Willard, and Battlefield point toward Greene County court resources.",
    },
    regionHighlights: [
      { title: "Suburban-first strategy", body: "The pages avoid a broad Springfield keyword and instead target nearby communities where local intent is clearer." },
      { title: "Two-county accuracy matters", body: "Correct court routing is the key quality signal for this cluster because it spans Christian and Greene counties." },
      { title: "DUI and PI both sell", body: "Springfield-area lawyers often serve the surrounding suburbs, making this package a practical lower-cost territory." },
    ],
    processNotes: [
      { label: "County split", title: "The city determines the court path", body: "Use the city page and official court notice to separate Christian County from Greene County routing." },
      { label: "Records", title: "Police reports stay local first", body: "Crash and incident reports usually begin with the municipal police department that handled the scene." },
      { label: "Sponsor package", title: "A sponsor can cover the ring instead of Springfield proper", body: "This keeps the pitch more affordable and more exclusive for suburban legal visibility." },
    ],
    court: christianCountyCourt,
    courtOffices: [christianCountyCourt, greeneCountyCourt],
    licenseOffice: office({
      name: "Ozark License Office",
      type: "Missouri License Office",
      address: "103 W. Church Street, Ozark, MO 65721",
      phone: "(417) 581-2955",
      hours: confirmHours,
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm current services and hours.",
    }),
    cities: [
      city({ slug: "nixa-mo", name: "Nixa", agency: "Nixa Police Department", police: police("Nixa Police Department", "715 W. Center Circle, Nixa, MO 65714", "(417) 725-2510", "https://www.nixa.com/departments/police-department/", "For Nixa police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "The Nixa Police Department publishes annual police reports that summarize department activities, events, and traffic-enforcement data.", sourceName: "Nixa annual police reports", sourceUrl: "https://www.nixa.com/annual-police-reports/", arrestSummary: "The 2023 Nixa Police annual report listed 12,916 traffic stops overall and described moving, equipment, license, and investigative traffic-stop categories.", arrestYear: "2023", arrestSourceName: "2023 Nixa Police annual report", arrestSourceUrl: "https://www.nixa.com/wp-content/uploads/2024/06/2023-NixaPoliceDepartment-AnnualReport.pdf", roads: ["U.S. Route 160", "Missouri Route 14", "Main Street", "Mount Vernon Street", "Nicholas Road"], jurisdictions: [jurisdiction("Nixa Police Department", "Municipal police", "Handles city traffic stops and crash reports in Nixa."), jurisdiction("Christian County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle state-route and highway enforcement.")] }) }),
      city({ slug: "ozark-mo", name: "Ozark", agency: "Ozark Police Department", police: police("Ozark Police Department", "201 E. Brick Street, Ozark, MO 65721", "(417) 581-6600", "https://www.ozarkmissouri.com/125/Police-Department", "For Ozark police reports, crash records, and Christian County court-adjacent questions."), dui_local_data: duiData({ summary: "Ozark's official police pages identify traffic-enforcement work and note that a 2024 Officer of the Year had led the department in DWI investigations for two years.", sourceName: "Ozark Police Officer of the Year page", sourceUrl: "https://ozarkmissouri.com/346/Officer-of-the-Year", roads: ["U.S. Route 65", "Missouri Route 14", "State Highway NN", "3rd Street", "Jackson Street"], jurisdictions: [jurisdiction("Ozark Police Department", "Municipal police", "Handles city traffic stops and crash reports in Ozark."), jurisdiction("Christian County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle U.S. 65 and state-route enforcement.")] }) }),
      city({ slug: "republic-mo", name: "Republic", agency: "Republic Police Department", police: police("Republic Police Department", "540 Civic Boulevard, Republic, MO 65738", "(417) 732-3900", "https://www.republicmo.com/", "For Republic police reports, crash records, and local enforcement questions."), courtOverride: greeneCountyCourt, personalInjuryCourtOverride: greeneCountyCourt, dui_local_data: duiData({ summary: "Republic Police published a 2024 annual traffic safety report describing traffic-safety grants for DWI and hazardous moving-violation enforcement.", sourceName: "Republic Police 2024 Annual Traffic Safety Report", sourceUrl: "https://www.republicmo.com/DocumentCenter/View/7698/Annual-Traffic-Report-2024", sourceDate: "2024", arrestSummary: "The 2024 report says Republic Police secured DWI and hazardous-moving-violation grants and logged approximately 219.75 overtime hours directed solely at traffic-safety enforcement during the grant cycle.", arrestYear: "2024", roads: ["U.S. Route 60", "Missouri Route 174", "Main Avenue", "Elm Street", "Wilson's Creek Boulevard"], jurisdictions: [jurisdiction("Republic Police Department", "Municipal police", "Handles city traffic stops and crash reports in Republic."), jurisdiction("Greene County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
      city({ slug: "willard-mo", name: "Willard", agency: "Willard Police Department", police: police("Willard Police Department", "795 Hughes Road, Willard, MO 65781", "(417) 742-3077", "https://www.cityofwillard.org/", "For Willard police reports, crash records, and local enforcement questions."), courtOverride: greeneCountyCourt, personalInjuryCourtOverride: greeneCountyCourt }),
      city({ slug: "battlefield-mo", name: "Battlefield", agency: "Battlefield Police Department", police: police("Battlefield Police Department", "5021 S. State Highway FF, Battlefield, MO 65619", "(417) 890-9876", "https://www.battlefieldmo.gov/page/police", "For Battlefield police reports, crash records, and local enforcement questions."), courtOverride: greeneCountyCourt, personalInjuryCourtOverride: greeneCountyCourt }),
    ],
  },
  {
    slug: "kansas-city-northland-mo",
    name: "Kansas City Northland",
    state: "Missouri",
    stateCode: "MO",
    teaser: "Northland guides for Liberty, Gladstone, North Kansas City, Parkville, and Riverside.",
    urgentDeadline: {
      headline: "Kansas City Northland pages need county-aware routing because the cluster spans Clay and Platte counties.",
      body: "Liberty, Gladstone, and North Kansas City point toward Clay County, while Parkville and Riverside commonly point toward Platte County resources.",
    },
    regionHighlights: [
      { title: "Avoids Kansas City proper first", body: "The Northland is easier to frame as an exclusive attorney territory than a broad Kansas City lawyer campaign." },
      { title: "Two-county structure", body: "The region page explains Clay and Platte court routing while city pages keep police and record contacts specific." },
      { title: "Strong DUI-first fit", body: "I-35, I-29, Highway 9, and river-corridor traffic support DUI and crash-report search intent." },
    ],
    processNotes: [
      { label: "Court split", title: "Clay or Platte County may control the court path", body: "Parkville and Riverside pages include Platte County overrides so readers do not assume everything goes through Liberty." },
      { label: "Local agency", title: "Police reports stay city-specific", body: "The right records contact depends on whether Liberty, Gladstone, North Kansas City, Parkville, or Riverside handled the incident." },
      { label: "Sponsor value", title: "Northland visibility is coherent and sellable", body: "A KC-area attorney can sponsor a recognizable suburban territory without buying an entire metro campaign." },
    ],
    court: clayCountyCourt,
    courtOffices: [clayCountyCourt, platteCountyCourt],
    licenseOffice: office({
      name: "Liberty License Office",
      type: "Missouri License Office",
      address: "137 N. Stewart Road, Liberty, MO 64068",
      phone: "(816) 407-9186",
      hours: confirmHours,
      href: moDorLocator,
      note: "Use the Missouri DOR locator to confirm current services and hours.",
    }),
    cities: [
      city({ slug: "liberty-mo", name: "Liberty", agency: "Liberty Police Department", police: police("Liberty Police Department", "1908 Plumber's Way, Suite 400, Liberty, MO 64068", "(816) 439-4701", "https://www.libertymissouri.gov/police", "For Liberty police reports, crash records, and Clay County court-adjacent questions."), dui_local_data: duiData({ summary: "Liberty Police provide public crime-mapping and police-record resources, including traffic accident report access and records-unit guidance.", sourceName: "Liberty Police Department", sourceUrl: "https://www.libertymissouri.gov/police", roads: ["I-35", "U.S. Route 69", "Missouri Route 291", "Kansas Street", "Withers Road"], jurisdictions: [jurisdiction("Liberty Police Department", "Municipal police", "Handles city traffic stops and crash reports in Liberty."), jurisdiction("Clay County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement and crash investigations.")] }) }),
      city({ slug: "gladstone-mo", name: "Gladstone", agency: "Gladstone Police Department", police: police("Gladstone Police Department", "7010 N. Holmes Street, Gladstone, MO 64118", "(816) 436-3550", "https://www.gladstone.mo.us/Police/", "For Gladstone police reports, crash records, and local enforcement questions.") }),
      city({ slug: "north-kansas-city-mo", name: "North Kansas City", agency: "North Kansas City Police Department", police: police("North Kansas City Police Department", "2020 Howell Street, North Kansas City, MO 64116", "(816) 274-6013", "https://www.nkc.org/", "For North Kansas City police reports, crash records, and local enforcement questions.") }),
      city({ slug: "parkville-mo", name: "Parkville", agency: "Parkville Police Department", police: police("Parkville Police Department", "8880 Clark Avenue, Parkville, MO 64152", "(816) 741-4454", "https://parkvillemo.gov/", "For Parkville police reports, crash records, and Platte County routing questions."), courtOverride: platteCountyCourt, personalInjuryCourtOverride: platteCountyCourt }),
      city({ slug: "riverside-mo", name: "Riverside", agency: "Riverside Public Safety Department", police: police("Riverside Public Safety Department", "2990 NW Vivion Road, Riverside, MO 64150", "(816) 741-1191", "https://www.riversidemo.gov/", "For Riverside public-safety reports, crash records, and Platte County routing questions.", "Public Safety Department"), courtOverride: platteCountyCourt, personalInjuryCourtOverride: platteCountyCourt }),
    ],
  },
  {
    slug: "guilford-county-triad-nc",
    name: "Guilford County Triad",
    state: "North Carolina",
    stateCode: "NC",
    practiceSlugs: ["dui"],
    teaser: "Greensboro, High Point, Jamestown, Summerfield, and Stokesdale DWI guides around the Guilford County court system.",
    urgentDeadline: {
      headline: "Guilford County DWI readers need to know which courthouse and agency are tied to the paperwork.",
      body: "Greensboro and High Point have separate courthouse locations, while smaller towns often require checking Guilford County Sheriff's Office district resources.",
    },
    regionHighlights: [
      { title: "Two courthouse anchors", body: "Guilford County is distinct from the existing Wake and Charlotte clusters because Greensboro and High Point each have official courthouse touchpoints." },
      { title: "Urban and county enforcement mix", body: "Greensboro, High Point, Jamestown, Summerfield, and Stokesdale create a real blend of city police, sheriff, and highway-patrol context." },
      { title: "Triad attorney market", body: "The cluster is large enough for DWI outreach while still selling a focused local territory instead of a broad statewide placement." },
    ],
    processNotes: [
      { label: "Courthouse", title: "Greensboro and High Point court routing can differ", body: "Readers should match the court notice to the correct Guilford County courthouse location before appearing in person." },
      { label: "Records", title: "Start with the agency on the citation or report", body: "A stop can involve Greensboro Police, High Point Police, Guilford County deputies, or North Carolina State Highway Patrol." },
      { label: "License", title: "NCDMV issues are separate from the criminal case", body: "A DWI arrest can create license questions that should be tracked separately from the first court date." },
    ],
    court: guilfordCountyCourt,
    courtOffices: [guilfordCountyCourt, guilfordHighPointCourt],
    licenseOffice: office({
      name: "NCDMV Driver License Office Locator",
      type: "NCDMV Driver License Office",
      address: "Use the NCDMV locator for the nearest current office.",
      phone: "(919) 715-7000",
      hours: "Confirm current hours with the NCDMV office locator.",
      href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
      note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
    }),
    sharedEnforcement: [
      police("Guilford County Sheriff's Office", "401 W. Sycamore Street, Greensboro, NC 27401", "(336) 641-3694", "https://www.guilfordcountync.gov/government/sheriffs-office/contact-gcso", "County law-enforcement contact for sheriff-handled matters and countywide questions.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "greensboro-nc", name: "Greensboro", agency: "Greensboro Police Department", police: police("Greensboro Police Department", "100 E. Police Plaza, Greensboro, NC 27402", "(336) 373-2222", "https://www.greensboro-nc.gov/departments/police?lv=true", "For Greensboro police reports, crash records, and city enforcement questions."), dui_local_data: duiData({ summary: "Greensboro Police publish department contact and records resources through the official city police site.", sourceName: "Greensboro Police Department", sourceUrl: "https://www.greensboro-nc.gov/departments/police?lv=true", roads: ["I-40", "I-85", "U.S. 29", "Battleground Avenue", "Gate City Boulevard"], jurisdictions: [jurisdiction("Greensboro Police Department", "Municipal police", "Handles city traffic stops and police records in Greensboro."), jurisdiction("Guilford County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "high-point-nc", name: "High Point", agency: "High Point Police Department", police: police("High Point Police Department", "1730 Westchester Drive, High Point, NC 27262", "(336) 883-3224", "https://www.highpointnc.gov/police", "For High Point police reports, crash records, and city enforcement questions."), courtOverride: guilfordHighPointCourt, dui_local_data: duiData({ summary: "High Point Police publish official contact information and records-oriented department resources on the city website.", sourceName: "High Point Police Department", sourceUrl: "https://www.highpointnc.gov/police", roads: ["I-74", "U.S. 311", "North Main Street", "Eastchester Drive", "Wendover Avenue"], jurisdictions: [jurisdiction("High Point Police Department", "Municipal police", "Handles city traffic stops and police records in High Point."), jurisdiction("Guilford County Sheriff's Office", "County sheriff", "May be involved in county areas or warrant/service matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "jamestown-nc", name: "Jamestown", agency: "Guilford County Sheriff's Office District 3", police: police("Guilford County Sheriff's Office District 3", "211 Hillstone Drive, Jamestown, NC 27282", "(336) 641-6691", "https://www.guilfordcountync.gov/government/sheriffs-office/services", "Jamestown readers should confirm whether Guilford County deputies, High Point Police, or another agency handled the report.", "County Sheriff"), courtOverride: guilfordHighPointCourt, dui_local_data: duiData({ summary: "The Guilford County Sheriff's Office lists District 3 in Jamestown as a patrol district office serving its geographical area.", sourceName: "Guilford County Sheriff's Office services", sourceUrl: "https://www.guilfordcountync.gov/government/sheriffs-office/services", roads: ["Main Street", "Guilford College Road", "East Fork Road", "Mackay Road", "I-74"], jurisdictions: [jurisdiction("Guilford County Sheriff's Office", "County sheriff", "Primary county agency for many Jamestown-area records questions."), jurisdiction("High Point Police Department", "Municipal police", "May be relevant near High Point jurisdictional boundaries."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "summerfield-nc", name: "Summerfield", agency: "Guilford County Sheriff's Office District 1", police: police("Guilford County Sheriff's Office District 1", "7504 Summerfield Road, Summerfield, NC 27358", "(336) 641-2300", "https://www.guilfordcountync.gov/government/sheriffs-office/services", "Summerfield readers should start with the Guilford County Sheriff's Office district contact when deputies handled the stop or report.", "County Sheriff"), dui_local_data: duiData({ summary: "The Guilford County Sheriff's Office lists District 1 in Summerfield as one of its patrol district offices.", sourceName: "Guilford County Sheriff's Office services", sourceUrl: "https://www.guilfordcountync.gov/government/sheriffs-office/services", roads: ["U.S. 220", "N.C. 150", "Summerfield Road", "Scalesville Road", "I-73"], jurisdictions: [jurisdiction("Guilford County Sheriff's Office", "County sheriff", "Primary county agency for many Summerfield-area records questions."), jurisdiction("Greensboro Police Department", "Municipal police", "May be relevant near Greensboro boundaries."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "stokesdale-nc", name: "Stokesdale", agency: "Guilford County Sheriff's Office District 1", police: police("Guilford County Sheriff's Office District 1", "7504 Summerfield Road, Summerfield, NC 27358", "(336) 641-2300", "https://www.guilfordcountync.gov/government/sheriffs-office/services", "Stokesdale readers should confirm whether Guilford County deputies or state patrol handled the stop or report.", "County Sheriff"), dui_local_data: duiData({ summary: "Stokesdale is covered through Guilford County Sheriff's Office patrol resources rather than a separate city police department page.", sourceName: "Guilford County Sheriff's Office services", sourceUrl: "https://www.guilfordcountync.gov/government/sheriffs-office/services", roads: ["U.S. 220", "N.C. 68", "N.C. 158", "Ellisboro Road", "Haw River Road"], jurisdictions: [jurisdiction("Guilford County Sheriff's Office", "County sheriff", "Primary county agency for many Stokesdale-area records questions."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
    ],
  },
  {
    slug: "new-hanover-coastal-nc",
    name: "New Hanover Coastal",
    state: "North Carolina",
    stateCode: "NC",
    practiceSlugs: ["dui"],
    teaser: "Wilmington, Wrightsville Beach, Carolina Beach, Kure Beach, and Castle Hayne DWI guides tied to New Hanover County court and coastal enforcement.",
    urgentDeadline: {
      headline: "Coastal DWI cases can involve city, beach-town, sheriff, or highway-patrol records before the courthouse step.",
      body: "New Hanover County readers should separate the agency that handled the stop from the courthouse and NCDMV license questions.",
    },
    regionHighlights: [
      { title: "Distinct coastal pattern", body: "This cluster has beach-town and tourism context that is very different from Wake, Charlotte, or Triad suburb pages." },
      { title: "One courthouse, several agencies", body: "Wilmington, Wrightsville Beach, Carolina Beach, Kure Beach, and Castle Hayne point to different police or sheriff records paths." },
      { title: "Sellable Wilmington-area territory", body: "A DWI attorney can sponsor a recognizable coastal market without buying a broad statewide campaign." },
    ],
    processNotes: [
      { label: "Agency first", title: "Beach-town stops are not all Wilmington cases", body: "The report source can change quickly between Wilmington Police, beach police, New Hanover deputies, and state patrol." },
      { label: "Court", title: "The courthouse anchor is in downtown Wilmington", body: "Criminal court and traffic-court questions generally orient around the New Hanover County Courthouse on Princess Street." },
      { label: "Seasonality", title: "Visitor traffic changes the practical questions", body: "Out-of-town drivers often need contact information, records, and license guidance before they can return to the area." },
    ],
    court: newHanoverCountyCourt,
    licenseOffice: office({
      name: "NCDMV Driver License Office Locator",
      type: "NCDMV Driver License Office",
      address: "Use the NCDMV locator for the nearest current office.",
      phone: "(919) 715-7000",
      hours: "Confirm current hours with the NCDMV office locator.",
      href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
      note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
    }),
    sharedEnforcement: [
      police("New Hanover County Sheriff's Office", "3950 Juvenile Center Road, Castle Hayne, NC 28429", "(910) 798-4200", "https://www.newhanoversheriff.com/795/Sheriffs-Office", "County sheriff contact for sheriff-handled records and Castle Hayne-area questions.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "wilmington-nc", name: "Wilmington", agency: "Wilmington Police Department", police: police("Wilmington Police Department", "615 Bess Street, Wilmington, NC 28401", "(910) 343-3600", "https://www.wilmingtonnc.gov/Public-Safety/Police-Department", "For Wilmington police reports, crash records, and city enforcement questions."), dui_local_data: duiData({ summary: "Wilmington Police publish headquarters contact information and incident/accident report access through the official city police page.", sourceName: "Wilmington Police Department", sourceUrl: "https://www.wilmingtonnc.gov/Public-Safety/Police-Department", roads: ["Market Street", "College Road", "Oleander Drive", "Carolina Beach Road", "I-140"], jurisdictions: [jurisdiction("Wilmington Police Department", "Municipal police", "Handles city traffic stops and police records in Wilmington."), jurisdiction("New Hanover County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "wrightsville-beach-nc", name: "Wrightsville Beach", agency: "Wrightsville Beach Police Department", police: police("Wrightsville Beach Police Department", "3 Bob Sawyer Drive, Wrightsville Beach, NC 28480", "(910) 256-7945", "https://www.townofwrightsvillebeach.com/160/Police", "For Wrightsville Beach police reports, accident reports, and beach-town enforcement questions."), dui_local_data: duiData({ summary: "Wrightsville Beach Police list accident-report links and partner-agency resources on the official police department page.", sourceName: "Wrightsville Beach Police Department", sourceUrl: "https://www.townofwrightsvillebeach.com/160/Police", roads: ["Eastwood Road", "Causeway Drive", "Lumina Avenue", "Salisbury Street", "U.S. 74"], jurisdictions: [jurisdiction("Wrightsville Beach Police Department", "Municipal police", "Handles local beach-town traffic stops and records."), jurisdiction("New Hanover County Sheriff's Office", "County sheriff", "May be involved in county or mutual-aid matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "carolina-beach-nc", name: "Carolina Beach", agency: "Carolina Beach Police Department", police: police("Carolina Beach Police Department", "1121 N. Lake Park Boulevard, Carolina Beach, NC 28428", "(910) 458-2540", "https://www.carolinabeach.gov/167/Police", "For Carolina Beach police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Carolina Beach Police publish official department contact information, including non-emergency dispatch and administrative office phone numbers.", sourceName: "Carolina Beach Police Department", sourceUrl: "https://www.carolinabeach.gov/167/Police", roads: ["Lake Park Boulevard", "Dow Road", "Carolina Beach Road", "Cape Fear Boulevard", "Winner Avenue"], jurisdictions: [jurisdiction("Carolina Beach Police Department", "Municipal police", "Handles town traffic stops and police records."), jurisdiction("New Hanover County Sheriff's Office", "County sheriff", "May be involved in county or mutual-aid matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "kure-beach-nc", name: "Kure Beach", agency: "Kure Beach Police Department", police: police("Kure Beach Police Department", "117 Settlers Lane, Kure Beach, NC 28449", "(910) 458-7586", "https://www.townofkurebeach.org/police-department", "For Kure Beach police reports and local enforcement questions."), dui_local_data: duiData({ summary: "Kure Beach Police publish official department information and contact details through the town website.", sourceName: "Kure Beach Police Department", sourceUrl: "https://www.townofkurebeach.org/police-department", roads: ["Fort Fisher Boulevard", "K Avenue", "Settlers Lane", "Dow Road", "U.S. 421"], jurisdictions: [jurisdiction("Kure Beach Police Department", "Municipal police", "Handles town traffic stops and police records."), jurisdiction("New Hanover County Sheriff's Office", "County sheriff", "May be involved in county or mutual-aid matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "castle-hayne-nc", name: "Castle Hayne", agency: "New Hanover County Sheriff's Office", police: police("New Hanover County Sheriff's Office", "3950 Juvenile Center Road, Castle Hayne, NC 28429", "(910) 798-4200", "https://www.newhanoversheriff.com/795/Sheriffs-Office", "Castle Hayne readers should confirm whether New Hanover County deputies or state patrol handled the stop or report.", "County Sheriff"), dui_local_data: duiData({ summary: "The New Hanover County Sheriff's Office lists its office in Castle Hayne as the county sheriff contact point.", sourceName: "New Hanover County Sheriff's Office", sourceUrl: "https://www.newhanoversheriff.com/795/Sheriffs-Office", roads: ["U.S. 117", "N.C. 133", "Castle Hayne Road", "I-140", "Blue Clay Road"], jurisdictions: [jurisdiction("New Hanover County Sheriff's Office", "County sheriff", "Primary local agency for many Castle Hayne-area records questions."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
    ],
  },
  {
    slug: "eastern-jackson-county-mo",
    name: "Eastern Jackson County",
    state: "Missouri",
    stateCode: "MO",
    practiceSlugs: ["dui"],
    teaser: "Independence, Blue Springs, Lee's Summit, Raytown, and Grain Valley DWI guides tied to eastern Jackson County.",
    urgentDeadline: {
      headline: "Eastern Jackson County DWI cases need court, police, and Missouri DOR questions separated early.",
      body: "The cities share Jackson County court context but have distinct police departments and commuter routes.",
    },
    regionHighlights: [
      { title: "Different from KC Northland", body: "This market uses Jackson County and Independence court context rather than Clay or Platte County routing." },
      { title: "Dense suburban buyer pool", body: "Independence, Blue Springs, Lee's Summit, Raytown, and Grain Valley create a coherent attorney outreach territory." },
      { title: "I-70 and I-470 corridor relevance", body: "Major commuter and interstate routes support DWI, traffic-defense, and records-search intent." },
    ],
    processNotes: [
      { label: "Court", title: "Use the Independence courthouse anchor", body: "Eastern Jackson County readers often orient around the 16th Circuit's Independence courthouse location." },
      { label: "Records", title: "Each city has its own police records path", body: "The agency named on the citation or report should drive the first records request." },
      { label: "License", title: "Missouri DOR deadlines run separately", body: "DWI cases can create administrative license issues outside the criminal court calendar." },
    ],
    court: easternJacksonCountyCourt,
    licenseOffice: stLouisCountyLicense,
    sharedEnforcement: [
      police("Missouri State Highway Patrol Troop A", "504 S.E. Blue Parkway, Lee's Summit, MO 64063", "(816) 622-0800", "https://www.mshp.dps.missouri.gov/HP71/searchTroop", "State patrol contact for highway enforcement context in the Kansas City region.", "State Patrol"),
    ],
    cities: [
      city({ slug: "independence-mo", name: "Independence", agency: "Independence Police Department", police: police("Independence Police Department", "223 N. Memorial Drive, Independence, MO 64050", "(816) 325-7300", "https://www.independencemo.gov/ipd", "For Independence police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Independence Police publish official department contact information through the City of Independence police page.", sourceName: "Independence Police Department", sourceUrl: "https://www.independencemo.gov/ipd", roads: ["I-70", "U.S. 24", "Noland Road", "Truman Road", "Missouri Route 291"], jurisdictions: [jurisdiction("Independence Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jackson County Sheriff's Office", "County sheriff", "May be involved in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "blue-springs-mo", name: "Blue Springs", agency: "Blue Springs Police Department", police: police("Blue Springs Police Department", "1100 SW Smith Street, Blue Springs, MO 64015", "(816) 228-0150", "https://www.bluespringsgov.com/police", "For Blue Springs police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Blue Springs Police publish official department contacts, records-unit contacts, and annual report links through the city police page.", sourceName: "Blue Springs Police Department", sourceUrl: "https://www.bluespringsgov.com/police", roads: ["I-70", "Missouri Route 7", "U.S. 40", "Adams Dairy Parkway", "Main Street"], jurisdictions: [jurisdiction("Blue Springs Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jackson County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate enforcement.")] }) }),
      city({ slug: "lees-summit-mo", name: "Lee's Summit", agency: "Lee's Summit Police Department", police: police("Lee's Summit Police Department", "10 NE Tudor Road, Lee's Summit, MO 64086", "(816) 969-1700", "https://cityofls.net/police-department/public-information/police-reports-records", "For Lee's Summit police reports, crash reports, and records-unit questions."), dui_local_data: duiData({ summary: "Lee's Summit Police publish records-unit procedures for report requests, accident reports, and discovery routing.", sourceName: "Lee's Summit Police Reports / Records", sourceUrl: "https://cityofls.net/police-department/public-information/police-reports-records", roads: ["I-470", "U.S. 50", "Missouri Route 291", "Chipman Road", "Douglas Street"], jurisdictions: [jurisdiction("Lee's Summit Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jackson County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "raytown-mo", name: "Raytown", agency: "Raytown Police Department", police: police("Raytown Police Department", "10000 E. 59th Street, Raytown, MO 64133", "(816) 737-6020", "https://www.raytownpolice.org/", "For Raytown police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Raytown Police publish official non-emergency contact and department information through the department website.", sourceName: "Raytown Police Department", sourceUrl: "https://www.raytownpolice.org/", roads: ["Raytown Road", "350 Highway", "Blue Ridge Boulevard", "63rd Street", "I-435"], jurisdictions: [jurisdiction("Raytown Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jackson County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "grain-valley-mo", name: "Grain Valley", agency: "Grain Valley Police Department", police: police("Grain Valley Police Department", "719 R.D. Mize Road, Grain Valley, MO 64029", "(816) 847-6250", "https://cityofgrainvalley.org/police/", "For Grain Valley police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Grain Valley Police publish official contact, dispatch, office, and patrol information through the city police page.", sourceName: "Grain Valley Police Department", sourceUrl: "https://cityofgrainvalley.org/police/", roads: ["I-70", "R.D. Mize Road", "Buckner Tarsney Road", "Main Street", "U.S. 40"], jurisdictions: [jurisdiction("Grain Valley Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jackson County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate enforcement.")] }) }),
    ],
  },
  {
    slug: "jasper-county-joplin-mo",
    name: "Jasper County Joplin",
    state: "Missouri",
    stateCode: "MO",
    practiceSlugs: ["dui"],
    teaser: "Joplin, Carthage, Webb City, Carl Junction, and Carterville DWI guides around Jasper County court resources.",
    urgentDeadline: {
      headline: "Jasper County DWI readers may need to distinguish the Carthage courthouse from the Joplin courts building.",
      body: "Police records stay city-specific, while court and Missouri DOR license questions can move on separate tracks.",
    },
    regionHighlights: [
      { title: "Southwest Missouri market", body: "This cluster is far from St. Louis, Columbia, Springfield suburbs, and Kansas City, giving it a distinct local footprint." },
      { title: "Two court buildings", body: "Jasper County uses Carthage and Joplin court locations, which gives the pages real local detail." },
      { title: "Route 66 and interstate context", body: "I-44, U.S. 71, Route 66, and local city corridors create DWI and traffic-defense search intent." },
    ],
    processNotes: [
      { label: "Court", title: "Confirm whether Carthage or Joplin is the right court location", body: "The citation, court notice, or clerk contact should control which Jasper County building a reader uses." },
      { label: "Records", title: "Police reports are city-specific", body: "Joplin, Carthage, Webb City, Carl Junction, and Carterville maintain separate local police contacts." },
      { label: "License", title: "Missouri DOR issues are not the same as court", body: "Administrative license questions should be tracked separately from criminal court scheduling." },
    ],
    court: jasperCountyCourt,
    courtOffices: [jasperCountyCourt, jasperJoplinCourt],
    licenseOffice: stLouisCountyLicense,
    sharedEnforcement: [
      police("Missouri State Highway Patrol Troop D", "3131 E. Kearney Street, Springfield, MO 65803", "(417) 895-6868", "https://www.mshp.dps.missouri.gov/HP71/searchTroop", "State patrol contact for southwest Missouri highway enforcement context.", "State Patrol"),
    ],
    cities: [
      city({ slug: "joplin-mo", name: "Joplin", agency: "Joplin Police Department", police: police("Joplin Police Department", "303 E. Third Street, Joplin, MO 64801", "(417) 623-3131", "https://www.joplinmo.org/police", "For Joplin police reports, crash records, and local enforcement questions."), courtOverride: jasperJoplinCourt, dui_local_data: duiData({ summary: "Joplin Police publish department resources and department history through the official city police page.", sourceName: "Joplin Police Department", sourceUrl: "https://www.joplinmo.org/police", roads: ["I-44", "I-49", "Range Line Road", "Main Street", "7th Street"], jurisdictions: [jurisdiction("Joplin Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jasper County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "carthage-mo", name: "Carthage", agency: "Carthage Police Department", police: police("Carthage Police Department", "310 W. 4th Street, Carthage, MO 64836", "(417) 237-7200", "https://www.carthagemo.gov/o/cpd/page/about-us/", "For Carthage police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Carthage Police publish official department address and phone information through the city police page.", sourceName: "Carthage Police Department", sourceUrl: "https://www.carthagemo.gov/o/cpd/page/about-us/", roads: ["I-49", "Route 66", "Central Avenue", "Garrison Avenue", "Grand Avenue"], jurisdictions: [jurisdiction("Carthage Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jasper County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "webb-city-mo", name: "Webb City", agency: "Webb City Police Department", police: police("Webb City Police Department", "200 S. Main Street, Webb City, MO 64870", "(417) 673-1911", "https://webbcitymo.org/police-department", "For Webb City police reports, crash records, and local enforcement questions."), dui_local_data: duiData({ summary: "Webb City Police publish official department information through the City of Webb City police page.", sourceName: "Webb City Police Department", sourceUrl: "https://webbcitymo.org/police-department", roads: ["Madison Street", "MacArthur Drive", "Main Street", "Route 66", "Missouri Route 171"], jurisdictions: [jurisdiction("Webb City Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jasper County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "carl-junction-mo", name: "Carl Junction", agency: "Carl Junction Police Department", police: police("Carl Junction Police Department", "302 N. Main Street, Carl Junction, MO 64834", "(417) 649-7237", "https://carljunction.socs.net/vnews/display.v/SEC/Government%7CDepartments", "For Carl Junction police reports, crash records, and local enforcement questions."), courtOverride: jasperJoplinCourt, dui_local_data: duiData({ summary: "Carl Junction lists its police department address and phone through the city's official departments page.", sourceName: "City of Carl Junction departments", sourceUrl: "https://carljunction.socs.net/vnews/display.v/SEC/Government%7CDepartments", roads: ["Main Street", "Pennell Street", "Joplin Street", "Fir Road", "Missouri Route 171"], jurisdictions: [jurisdiction("Carl Junction Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jasper County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "carterville-mo", name: "Carterville", agency: "Carterville Police Department", police: police("Carterville Police Department", "1200 E. First Street, Carterville, MO 64835", "(417) 673-5303", "https://cartervillemo.com/police-main", "For Carterville police reports, crash records, and local enforcement questions."), courtOverride: jasperJoplinCourt, dui_local_data: duiData({ summary: "Carterville Police publish official department information through the city police page.", sourceName: "Carterville Police Department", sourceUrl: "https://cartervillemo.com/police-main", roads: ["Main Street", "First Street", "Route 66", "Missouri Route 171", "Prosperity Road"], jurisdictions: [jurisdiction("Carterville Police Department", "Municipal police", "Handles city traffic stops and police records."), jurisdiction("Jasper County Sheriff's Office", "County sheriff", "May be involved outside city limits or in county matters."), jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
    ],
  },
  {
    slug: "cabarrus-county-nc",
    name: "Cabarrus County",
    state: "North Carolina",
    stateCode: "NC",
    practiceSlugs: ["dui"],
    teaser: "Concord, Kannapolis, Harrisburg, Mount Pleasant, and Midland DWI guides tied to Cabarrus County court and law-enforcement routing.",
    urgentDeadline: {
      headline: "Cabarrus County DWI paperwork can involve city police, sheriff coverage, and county court on separate tracks.",
      body: "Concord and Kannapolis have municipal departments, while Harrisburg, Mount Pleasant, and Midland often route law-enforcement questions through Cabarrus County Sheriff's Office resources.",
    },
    regionHighlights: [
      { title: "New Charlotte-adjacent county", body: "Cabarrus gives the site a separate county-court footprint from Mecklenburg, Union, Wake, Guilford, and New Hanover." },
      { title: "Agency mix is real", body: "Concord and Kannapolis are city-police pages, while the smaller-town pages need sheriff and county-service context." },
      { title: "Strong sponsor story", body: "A Concord or Cabarrus DWI attorney can understand this as one coherent package rather than a broad Charlotte placement." },
    ],
    processNotes: [
      { label: "Court", title: "Cabarrus County Courthouse is the court anchor", body: "DWI court questions should be checked through the official notice and Cabarrus County court resources in Concord." },
      { label: "Records", title: "The agency on the paperwork matters", body: "A stop may involve Concord Police, Kannapolis Police, Cabarrus County deputies, or North Carolina State Highway Patrol." },
      { label: "License", title: "NCDMV consequences can move separately", body: "Civil revocation and limited-driving-privilege questions should be separated from the first court date." },
    ],
    court: cabarrusCountyCourt,
    licenseOffice: office({
      name: "NCDMV Driver License Office Locator",
      type: "NCDMV Driver License Office",
      address: "Use the NCDMV locator for the nearest current office.",
      phone: "(919) 715-7000",
      hours: "Confirm current hours with the NCDMV office locator.",
      href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
      note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
    }),
    sharedEnforcement: [
      police("Cabarrus County Sheriff's Office", "30 Corban Avenue SE, Concord, NC 28025", "(704) 920-3000", "https://www.cabarruslaw.us/", "County law-enforcement contact for sheriff-handled matters, courthouse security, county records, and smaller-town coverage.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "concord-nc", name: "Concord", agency: "Concord Police Department", police: police("Concord Police Department", "41 Cabarrus Avenue W, Concord, NC 28026", "(704) 920-5000", "https://concordnc.gov/Departments/Police", "For Concord police reports, crash records, video questions, and city enforcement records."), dui_local_data: duiData({ summary: "Concord Police publish department directory, records, communications, and public-safety contact information through the official city police site.", sourceName: "Concord Police Department", sourceUrl: "https://concordnc.gov/Departments/Police", roads: ["I-85", "U.S. 29", "NC 49", "Concord Parkway", "Cabarrus Avenue", "Church Street"], jurisdictions: [jurisdiction("Concord Police Department", "Municipal police", "Handles city traffic stops and police records inside Concord."), jurisdiction("Cabarrus County Sheriff's Office", "County sheriff", "May be involved in county matters, courthouse security, or incidents outside city limits."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "kannapolis-nc", name: "Kannapolis", agency: "Kannapolis Police Department", police: police("Kannapolis Police Department", "401 Laureate Way, Kannapolis, NC 28081", "(704) 920-4444", "https://www.kannapolisnc.gov/Government-Departments/Police", "For Kannapolis police reports, crash records, and city enforcement questions."), dui_local_data: duiData({ summary: "Kannapolis Police publish official department information, service links, and contact information through the City of Kannapolis police page.", sourceName: "Kannapolis Police Department", sourceUrl: "https://www.kannapolisnc.gov/Government-Departments/Police", roads: ["I-85", "U.S. 29", "Dale Earnhardt Boulevard", "Cannon Boulevard", "Main Street"], jurisdictions: [jurisdiction("Kannapolis Police Department", "Municipal police", "Handles city traffic stops and police records in Kannapolis."), jurisdiction("Cabarrus County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
      city({ slug: "harrisburg-nc", name: "Harrisburg", agency: "Cabarrus County Sheriff's Office", police: police("Cabarrus County Sheriff's Office", "30 Corban Avenue SE, Concord, NC 28025", "(704) 920-3000", "https://www.harrisburgnc.gov/167/Law-Enforcement", "Harrisburg law-enforcement questions generally route through Cabarrus County Sheriff's Office services.", "County Sheriff"), dui_local_data: duiData({ summary: "The Town of Harrisburg says it partners with Cabarrus County Sheriff's Office for law-enforcement services.", sourceName: "Harrisburg law enforcement", sourceUrl: "https://www.harrisburgnc.gov/167/Law-Enforcement", roads: ["NC 49", "Roberta Road", "Morehead Road", "Harrisburg Veterans Road", "Rocky River Road"], jurisdictions: [jurisdiction("Cabarrus County Sheriff's Office", "County sheriff", "Primary law-enforcement reference for Harrisburg records and local enforcement questions."), jurisdiction("Concord Police Department", "Municipal police", "May be relevant near jurisdictional boundaries."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle state-route and highway enforcement.")] }) }),
      city({ slug: "mount-pleasant-nc", name: "Mount Pleasant", agency: "Cabarrus County Sheriff's Office", police: police("Cabarrus County Sheriff's Office", "30 Corban Avenue SE, Concord, NC 28025", "(704) 920-3000", "https://mtpleasantnc.gov/Government/Public-Safety", "Mount Pleasant contracts with Cabarrus County Sheriff's Department for enhanced community policing.", "County Sheriff"), dui_local_data: duiData({ summary: "The Town of Mount Pleasant public-safety page says the town contracts with Cabarrus County Sheriff's Department for enhanced community policing.", sourceName: "Mount Pleasant public safety", sourceUrl: "https://mtpleasantnc.gov/Government/Public-Safety", roads: ["NC 49", "NC 73", "Main Street", "Franklin Street", "Mount Pleasant Road"], jurisdictions: [jurisdiction("Cabarrus County Sheriff's Office", "County sheriff", "Primary law-enforcement reference for many Mount Pleasant records questions."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
      city({ slug: "midland-nc", name: "Midland", agency: "Cabarrus County Sheriff's Office", police: police("Cabarrus County Sheriff's Office", "30 Corban Avenue SE, Concord, NC 28025", "(704) 920-3000", "https://www.cabarruslaw.us/", "Midland readers should confirm whether Cabarrus County deputies, state patrol, or another agency handled the stop or report.", "County Sheriff"), dui_local_data: duiData({ summary: "Cabarrus County Sheriff's Office is the county law-enforcement contact for sheriff-handled matters; Midland is a separate town with its own local-government identity and county-service context.", sourceName: "Cabarrus County Sheriff's Office", sourceUrl: "https://www.cabarruslaw.us/", roads: ["NC 24/27", "Bethel School Road", "Midland Road", "U.S. 601", "Flowes Store Road"], jurisdictions: [jurisdiction("Cabarrus County Sheriff's Office", "County sheriff", "Primary records reference for many Midland-area law-enforcement questions."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
    ],
  },
  {
    slug: "durham-orange-triangle-nc",
    name: "Durham / Orange Triangle",
    state: "North Carolina",
    stateCode: "NC",
    practiceSlugs: ["dui"],
    teaser: "Durham, Chapel Hill, Carrboro, and Hillsborough DWI guides with two courthouse systems and college-town traffic context.",
    urgentDeadline: {
      headline: "Triangle West DWI readers need to know whether the case points to Durham County or Orange County.",
      body: "Durham has its own courthouse and police department, while Chapel Hill, Carrboro, and Hillsborough generally point to Orange County court resources and separate town police records.",
    },
    regionHighlights: [
      { title: "Two courthouse systems", body: "Durham County and Orange County make this cluster meaningfully different from Wake County and the Charlotte-area pages." },
      { title: "College-town and commuter context", body: "UNC, downtown Durham, I-40, U.S. 15-501, NC 54, and town-center traffic create distinct DWI search intent." },
      { title: "High-value attorney market", body: "The package gives a sponsor focused Triangle West visibility without trying to sell a broad Raleigh-Durham placement." },
    ],
    processNotes: [
      { label: "County line", title: "Court routing is the first local question", body: "Durham cases and Orange County cases may involve different courthouse addresses, clerks, and local traffic-court resources." },
      { label: "Agency", title: "Police records are city-specific", body: "Durham, Chapel Hill, Carrboro, and Hillsborough have separate police records and public-safety contacts." },
      { label: "License", title: "NCDMV issues remain separate", body: "Civil revocation and limited-driving-privilege questions should be tracked apart from the criminal court calendar." },
    ],
    court: durhamCountyCourt,
    courtOffices: [durhamCountyCourt, orangeCountyCourt],
    licenseOffice: office({
      name: "NCDMV Driver License Office Locator",
      type: "NCDMV Driver License Office",
      address: "Use the NCDMV locator for the nearest current office.",
      phone: "(919) 715-7000",
      hours: "Confirm current hours with the NCDMV office locator.",
      href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
      note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
    }),
    sharedEnforcement: [
      police("Orange County Sheriff's Office", "106 E. Margaret Lane, Hillsborough, NC 27278", "(919) 245-2900", "https://www.ocsonc.com/", "County law-enforcement contact for Orange County sheriff-handled matters and countywide records questions.", "County Sheriff"),
    ],
    cities: [
      city({ slug: "durham-nc", name: "Durham", agency: "Durham Police Department", police: police("Durham Police Department", "602 E. Main Street, Durham, NC 27701", "(919) 560-4427", "https://www.durhamnc.gov/149/Police", "For Durham police reports, crash records, and city enforcement questions."), dui_local_data: duiData({ summary: "Durham Police publish official headquarters, contact, reporting, and district information through the city police site.", sourceName: "Durham Police Department", sourceUrl: "https://www.durhamnc.gov/149/Police", roads: ["NC 147", "I-85", "U.S. 15-501", "Roxboro Street", "Main Street", "Fayetteville Street"], jurisdictions: [jurisdiction("Durham Police Department", "Municipal police", "Handles city traffic stops and police records inside Durham."), jurisdiction("Durham County Sheriff's Office", "County sheriff", "May be involved in county matters or courthouse-related issues."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway enforcement.")] }) }),
      city({ slug: "chapel-hill-nc", name: "Chapel Hill", agency: "Chapel Hill Police Department", police: police("Chapel Hill Police Department", "7300 Millhouse Road, Chapel Hill, NC 27516", "(919) 968-2760", "https://www.chapelhillnc.gov/Town-Government/Departments-and-Offices/Police", "For Chapel Hill police reports, crash records, and town enforcement questions."), courtOverride: orangeCountyCourt, dui_local_data: duiData({ summary: "Chapel Hill Police publish official department contact, report, crisis, and service resources through the town police page.", sourceName: "Chapel Hill Police Department", sourceUrl: "https://www.chapelhillnc.gov/Town-Government/Departments-and-Offices/Police", roads: ["U.S. 15-501", "NC 54", "Franklin Street", "Fordham Boulevard", "Martin Luther King Jr Boulevard"], jurisdictions: [jurisdiction("Chapel Hill Police Department", "Municipal police", "Handles town traffic stops and police records."), jurisdiction("Orange County Sheriff's Office", "County sheriff", "May be involved outside town limits or on county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement.")] }) }),
      city({ slug: "carrboro-nc", name: "Carrboro", agency: "Carrboro Police Department", police: police("Carrboro Police Department", "100 N. Greensboro Street, Carrboro, NC 27510", "(919) 918-7397", "https://www.carrboronc.gov/225/Police", "For Carrboro police reports, crash records, and town enforcement questions."), courtOverride: orangeCountyCourt, dui_local_data: duiData({ summary: "Carrboro Police publish official department information, directory details, and public-service resources through the town site.", sourceName: "Carrboro Police Department", sourceUrl: "https://www.carrboronc.gov/225/Police", roads: ["NC 54", "Main Street", "N. Greensboro Street", "Jones Ferry Road", "Weaver Street"], jurisdictions: [jurisdiction("Carrboro Police Department", "Municipal police", "Handles town traffic stops and police records."), jurisdiction("Orange County Sheriff's Office", "County sheriff", "May be involved outside town limits or on county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle state-route enforcement.")] }) }),
      city({ slug: "hillsborough-nc", name: "Hillsborough", agency: "Hillsborough Police Department", police: police("Hillsborough Police Department", "127 N. Churton Street, Hillsborough, NC 27278", "(919) 296-9500", "https://www.hillsboroughnc.gov/about-us/contact-us/contact-police", "For Hillsborough police reports, crash records, and town enforcement questions."), courtOverride: orangeCountyCourt, dui_local_data: duiData({ summary: "Hillsborough Police publish contact information for the police station and weekday office coverage through the town police contact page.", sourceName: "Hillsborough Police Department", sourceUrl: "https://www.hillsboroughnc.gov/about-us/contact-us/contact-police", roads: ["I-85", "I-40", "Churton Street", "U.S. 70", "NC 86"], jurisdictions: [jurisdiction("Hillsborough Police Department", "Municipal police", "Handles town traffic stops and police records."), jurisdiction("Orange County Sheriff's Office", "County sheriff", "May be involved outside town limits or on county matters."), jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle interstate and highway enforcement.")] }) }),
    ],
  },
];

export const siteData = {
  siteName: "Local Legal Guides",
  siteTagline: "Local legal guides by city",
  siteDescription:
    "Local legal guides for DUI, DWI, personal injury, city courts, agencies, deadlines, and official local resources.",
  domain: "locallegalguides.com",
  legalEmail: "legal@locallegalguides.com",
  privacyEmail: "privacy@locallegalguides.com",
  sponsorsEmail: "sponsors@locallegalguides.com",
  lastVerified: "2026-05-07",
  year: 2026,
  sponsorPackages: {
    "madison-county-il": {
      status: "available",
      termLabel: "12-month exclusive package",
      coverageLabel: "5 Illinois city pages for one selected practice area",
      sponsor: {
        firmName: "",
        attorneyName: "",
        phone: "",
        ctaUrl: "",
        officeAddress: "",
        serviceArea: "",
        shortBio: "",
        photoUrl: "",
        disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
      },
    },
    "st-charles-county-mo": {
      status: "preview",
      termLabel: "12-month exclusive package",
      coverageLabel: "5 Missouri city pages for one selected practice area",
      sponsor: {
        firmName: "Your Firm Here",
        attorneyName: "Sponsor Preview",
        phone: "(555) 010-2000",
        ctaUrl: "/contact/",
        officeAddress: "Demo placement shown for St. Charles County package previews.",
        serviceArea: "St. Charles County sponsor package preview",
        shortBio:
          "This is a sample sponsor profile to show attorneys exactly how a sold regional package would appear on the cluster page and the related city guides.",
        photoUrl: "",
        disclaimer: "Preview sponsor card for sales demos only. Replace with real sponsor details before launch.",
      },
    },
    "west-st-louis-county-mo": {
      status: "available",
      termLabel: "12-month exclusive package",
      coverageLabel: "5 Missouri city pages for one selected practice area",
      sponsor: {
        firmName: "",
        attorneyName: "",
        phone: "",
        ctaUrl: "",
        officeAddress: "",
        serviceArea: "",
        shortBio: "",
        photoUrl: "",
        disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
      },
    },
    "charlotte-south-nc": {
      status: "available",
      termLabel: "12-month exclusive package",
      coverageLabel: "4 North Carolina city pages for one selected practice area",
      sponsor: {
        firmName: "",
        attorneyName: "",
        phone: "",
        ctaUrl: "",
        officeAddress: "",
        serviceArea: "",
        shortBio: "",
        photoUrl: "",
        disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
      },
    },
    "raleigh-north-nc": {
      status: "available",
      termLabel: "12-month exclusive package",
      coverageLabel: "4 North Carolina city pages for one selected practice area",
      sponsor: {
        firmName: "",
        attorneyName: "",
        phone: "",
        ctaUrl: "",
        officeAddress: "",
        serviceArea: "",
        shortBio: "",
        photoUrl: "",
        disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
      },
    },
    "wake-southwest-nc": {
      status: "available",
      termLabel: "12-month exclusive package",
      coverageLabel: "4 North Carolina city pages for one selected practice area",
      sponsor: {
        firmName: "",
        attorneyName: "",
        phone: "",
        ctaUrl: "",
        officeAddress: "",
        serviceArea: "",
        shortBio: "",
        photoUrl: "",
        disclaimer: "Attorney Advertising. Sponsorship does not imply endorsement.",
      },
    },
    ...expansionSponsorPackages,
  },
  legalBasics: {
    IL: {
      duiName: "DUI",
      duiThreshold: "0.08% BAC",
      duiCharge: "A first DUI is generally a Class A misdemeanor unless aggravating facts apply.",
      duiLicense:
        "A statutory summary suspension is separate from the criminal case and can begin 46 days after notice.",
      personalInjuryDeadline:
        "Illinois generally gives two years to file personal injury claims, though claims involving government defendants can have shorter notice rules.",
      injuryVenue:
        "Injury lawsuits are usually filed in the county where the crash or injury happened, or where a defendant can be sued.",
      sources: [
        {
          label: "Illinois DUI statute",
          href: "https://www.ilga.gov/documents/legislation/ilcs/documents/062500050K11-501.htm",
        },
        {
          label: "Illinois Secretary of State DUI information",
          href: "https://www.ilsos.gov/departments/drivers/traffic-safety/dui.html",
        },
        {
          label: "Illinois license reinstatement guidance",
          href: "https://www.ilsos.gov/departments/baiid/reinstate.html",
        },
        {
          label: "Illinois personal injury limitations period",
          href: "https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=073500050K13-202",
        },
      ],
    },
    MO: {
      duiName: "DWI",
      duiThreshold: "0.08% BAC",
      duiCharge: "Missouri treats driving while intoxicated as a criminal case, with penalties increasing for prior offenses and aggravating facts.",
      duiLicense:
        "A DWI arrest can create a separate administrative license case through the Missouri Department of Revenue.",
      personalInjuryDeadline:
        "Missouri generally uses a five-year limitations period for personal injury claims.",
      injuryVenue:
        "Civil injury lawsuits are usually filed in the circuit court connected to the county where venue is proper.",
      sources: [
        {
          label: "Missouri DWI statute",
          href: "https://revisor.mo.gov/main/OneSection.aspx?section=577.010",
        },
        {
          label: "Missouri administrative alcohol law",
          href: "https://dor.mo.gov/driver-license/revocation-suspension/intoxication.html",
        },
        {
          label: "Missouri personal injury limitations period",
          href: "https://revisor.mo.gov/main/OneSection.aspx?section=516.120",
        },
      ],
    },
    NC: {
      duiName: "DWI",
      duiThreshold: "0.08% alcohol concentration",
      duiCharge: "North Carolina prosecutes impaired driving under G.S. 20-138.1, with sentencing levels based on aggravating and mitigating factors.",
      duiLicense:
        "A DWI arrest can create immediate license consequences, including a civil revocation in qualifying cases.",
      personalInjuryDeadline:
        "North Carolina generally gives three years for personal injury claims.",
      injuryVenue:
        "Civil injury lawsuits are filed through the county court system when venue is proper there.",
      sources: [
        {
          label: "North Carolina impaired driving statute",
          href: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_20/GS_20-138.1.html",
        },
        {
          label: "North Carolina DWI sentencing statute",
          href: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_20/GS_20-179.html",
        },
        {
          label: "North Carolina personal injury limitations period",
          href: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_1/GS_1-52.html",
        },
      ],
    },
  },
  practiceAreas: [
    {
      slug: "dui",
      label: "DUI",
      title: "DUI Legal Guide",
      summary:
        "Driving under the influence, license suspension, court process, and local agencies.",
    },
    {
      slug: "personal-injury",
      label: "Personal Injury",
      title: "Personal Injury Legal Guide",
      summary:
        "Car crashes, slip-and-fall claims, and the local court and filing process.",
    },
  ],
  regions: [
    {
      slug: "madison-county-il",
      name: "Madison County Metro East",
      state: "Illinois",
      stateCode: "IL",
      teaser: "Metro East guides centered on Edwardsville and surrounding Madison County cities.",
      urgentDeadline: {
        headline: "Illinois DUI timing can move before the first full court strategy is in place.",
        body: "Madison County drivers often need to track the criminal case, police records, and Illinois Secretary of State license consequences at the same time.",
      },
      regionHighlights: [
        {
          title: "Interstate-heavy enforcement pattern",
          body: "This Metro East cluster sits along I-55, I-70, I-255, and Route 159 corridors, so stops can involve city police, the sheriff, or Illinois State Police depending on where the contact started.",
        },
        {
          title: "Edwardsville is the county anchor",
          body: "Even when the stop or crash happened in Collinsville, Glen Carbon, Maryville, or Troy, readers usually end up orienting around the Edwardsville courthouse and related county offices.",
        },
        {
          title: "Criminal and records paths can split",
          body: "Madison County has separate court, clerk, and criminal justice touchpoints, which is why this region page helps before someone chases the wrong building or office window.",
        },
        {
          title: "State police overlap matters here",
          body: "Because the cluster includes major highway traffic near the St. Louis edge, state-patrol involvement is more common than in a purely residential suburb cluster.",
        },
      ],
      processNotes: [
        {
          label: "Highway stops",
          title: "Figure out whether the stop was municipal, county, or state",
          body: "That first question can change where police records come from and which enforcement office a reader needs to contact before a court date.",
        },
        {
          label: "Court buildings",
          title: "Madison County uses more than one criminal-justice touchpoint",
          body: "Readers should confirm whether they need the main courthouse, the circuit clerk, or a criminal-justice building before showing up in Edwardsville.",
        },
        {
          label: "Driver services",
          title: "License questions usually point back to the Edwardsville driver-services office",
          body: "That makes the region page useful for sorting out state-level license issues before drilling down into one city guide.",
        },
      ],
      court: {
        name: "Madison County Courthouse",
        address: "155 N. Main Street, Edwardsville, IL 62025",
        phone: "(618) 296-4470",
        hours: "Monday-Friday, 8:30 am-4:30 pm",
        courtSystem: "Third Judicial Circuit",
        href: "https://www.illinoiscourts.gov/courts-directory/100/Madison-County-Courthouse/court/",
      },
      courtOffices: [
        {
          name: "Madison County Courthouse",
          type: "Circuit Court",
          address: "155 N. Main Street, Edwardsville, IL 62025",
          phone: "(618) 296-4470",
          hours: "Monday-Friday, 8:30 am-4:30 pm",
          href: "https://www.illinoiscourts.gov/courts-directory/100/Madison-County-Courthouse/court/",
          note: "Primary courthouse for Madison County Circuit Court matters.",
        },
        {
          name: "Madison County Circuit Clerk",
          type: "Court records and filings",
          address: "155 N. Main Street, Edwardsville, IL 62025",
          phone: "(618) 692-6240",
          hours: "Call to confirm counter hours before visiting.",
          href: "https://www.madisoncountyil.gov/departments/circuit_clerk/index.php",
          note: "Use for case records, fines, court dates, and filing questions.",
        },
        {
          name: "Madison County Criminal Justice Center",
          type: "Criminal court location",
          address: "509 Ramey Street, Edwardsville, IL 62025",
          phone: "(618) 692-8932",
          hours: "Call to confirm the correct courtroom before appearing.",
          href: "https://www.madcosao.gov/faq",
          note: "The Madison County State's Attorney FAQ lists this as a court location for some criminal appearances.",
        },
      ],
      sharedEnforcement: [
        {
          name: "Madison County Sheriff's Office",
          type: "County Sheriff",
          address: "405 Randle Street, Edwardsville, IL 62025",
          phone: "(618) 692-4433",
          href: "https://www.madisoncountyil.gov/departments/sheriff/index.php",
          note: "County agency that may be involved outside municipal limits or on county matters.",
        },
        {
          name: "Illinois State Police - District 11",
          type: "State Police",
          address: "1100 Eastport Plaza Drive, Collinsville, IL 62234",
          phone: "(618) 346-3990",
          href: "https://isp.illinois.gov/",
          note: "State patrol agency for highways and state-level traffic enforcement.",
        },
      ],
      licenseOffice: {
        name: "Illinois Secretary of State Driver Services Facility - Edwardsville",
        type: "Driver Services",
        address: "1502A Troy Road, Edwardsville, IL 62025",
        phone: "(618) 656-8956",
        hours: "Hours change periodically; confirm with the Secretary of State before visiting.",
        href: "https://www.ilsos.gov/",
        note: "Nearest full driver services reference for licenses, IDs, written testing, road testing, CDL written testing, registration, titles, and plates.",
      },
      cities: [
        {
          slug: "collinsville-il",
          name: "Collinsville",
          agency: "Collinsville Police Department",
          police: {
            name: "Collinsville Police Department",
            type: "Municipal Police",
            address: "200 W. Clay Street, Collinsville, IL 62234",
            phone: "(618) 344-2131",
            hours: "Front desk and records hours vary; call before visiting.",
            href: "https://www.collinsvilleil.org/departments/police-department/",
            note: "For city police records, local crash reports, and municipal law-enforcement questions.",
          },
        },
        {
          slug: "edwardsville-il",
          name: "Edwardsville",
          agency: "Edwardsville Police Department",
          police: {
            name: "Edwardsville Police Department",
            type: "Municipal Police",
            address: "333 S. Main Street, Edwardsville, IL 62025",
            phone: "(618) 656-2131",
            href: "https://www.cityofedwardsville.com/police",
            note: "For city police records, local crash reports, and municipal law-enforcement questions.",
          },
          dui_local_data: {
            enforcement_snapshot: {
              summary:
                "Edwardsville Police have participated in Illinois impaired-driving enforcement campaigns such as Drive Sober or Get Pulled Over and Drive High, Get a DUI.",
              source_name: "Edwardsville Police St. Patrick's Day enforcement results",
              source_url: "https://www.theintelligencer.com/news/article/edwardsville-il-st-patricks-enforcement-results-22096075.php",
              source_date: "March 2026",
            },
            past_campaigns: [
              {
                campaign_name: "St. Patrick's Day traffic safety campaign",
                date_range: "March 13-23, 2026",
                results_summary:
                  "Edwardsville Police reported 32 traffic stops, 31 citations, and three arrests, including one impaired-driving arrest.",
                source_name: "The Edwardsville Intelligencer",
                source_url: "https://www.theintelligencer.com/news/article/edwardsville-il-st-patricks-enforcement-results-22096075.php",
              },
            ],
            crash_context: {
              summary:
                "The Illinois Secretary of State's DUI Fact Book reported 21,245 DUI arrests and 288 alcohol-related crash deaths statewide in the most recent statewide reporting year.",
              source_name: "Illinois Secretary of State DUI Fact Book 2025",
              source_url: "https://www.ilsos.gov/content/dam/publications/pdf_publications/dsd_a118.pdf",
            },
            local_roads: [
              "I-55",
              "I-70",
              "I-255",
              "Illinois Route 157",
              "Illinois Route 159",
              "Governors' Parkway",
              "Troy Road",
            ],
            jurisdiction_notes: [
              {
                agency: "Edwardsville Police Department",
                role: "Municipal police",
                notes: "Handles local city traffic stops and crash reports within Edwardsville.",
              },
              {
                agency: "Madison County Sheriff's Office",
                role: "County sheriff",
                notes: "May be involved in county-level enforcement or incidents outside city limits.",
              },
              {
                agency: "Illinois State Police",
                role: "State police",
                notes: "May handle impaired-driving enforcement and crashes on state highways and interstates.",
              },
            ],
            data_availability_note:
              "City-level DUI arrest data is not published consistently across every police department. This guide uses local campaign results, official state sources, and county/state context when city-level data is unavailable.",
          },
        },
        {
          slug: "glen-carbon-il",
          name: "Glen Carbon",
          agency: "Glen Carbon Police Department",
          police: {
            name: "Glen Carbon Police Department",
            type: "Municipal Police",
            address: "149 N. Main Street, Glen Carbon, IL 62034",
            phone: "(618) 288-7226",
            href: "https://www.glencarbonil.gov/187/Police-Department",
            note: "For village police records, local crash reports, and municipal law-enforcement questions.",
          },
        },
        {
          slug: "maryville-il",
          name: "Maryville",
          agency: "Maryville Police Department",
          police: {
            name: "Maryville Police Department",
            type: "Municipal Police",
            address: "2500 N. Center Street, Maryville, IL 62062",
            phone: "(618) 344-8899",
            hours: "Lobby open 24 hours; business office generally Monday-Friday, 8:00 am-4:30 pm.",
            href: "https://www.vil.maryville.il.us/99/Police",
            note: "For village police records, local crash reports, and municipal law-enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Maryville's official police page identifies traffic enforcement as one of the services provided by the village police department.",
            sourceName: "Village of Maryville Police Department",
            sourceUrl: "https://www.vil.maryville.il.us/99/Police",
            roads: ["I-55", "I-70", "Illinois Route 159", "Illinois Route 162", "N. Center Street"],
            jurisdictions: [
              jurisdiction("Maryville Police Department", "Municipal police", "Handles local traffic enforcement and crash reports inside Maryville."),
              jurisdiction("Madison County Sheriff's Office", "County sheriff", "May be involved outside municipal limits or on county-level matters."),
              jurisdiction("Illinois State Police", "State police", "May handle crashes and impaired-driving enforcement on interstate or state routes."),
            ],
          }),
        },
        {
          slug: "troy-il",
          name: "Troy",
          agency: "Troy Police Department",
          police: {
            name: "Troy Police Department",
            type: "Municipal Police",
            address: "116 E. Market Street, Troy, IL 62294",
            phone: "(618) 667-6731",
            href: "https://www.troyil.us/238/Police-Department",
            note: "For city police records, local crash reports, and municipal law-enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Troy Police reported a Labor Day impaired-driving and traffic-safety effort tied to Illinois Drive Sober, Drive High Get a DUI, and Click It or Ticket campaigns.",
            sourceName: "RiverBender Troy Police Labor Day enforcement report",
            sourceUrl: "https://www.riverbender.com/news/details/troy-police-conduct-extensive-labor-day-impaired-driving-enforcement-85893.cfm",
            sourceDate: "September 2025",
            campaigns: [
              {
                campaign_name: "Labor Day impaired-driving enforcement campaign",
                date_range: "Labor Day weekend 2025",
                results_summary:
                  "Troy Police reported 51 traffic stops, 26 seat-belt citations, one suspended-driver arrest, seven distracted-driving citations, six speeding citations, and 10 other citations.",
                source_name: "RiverBender",
                source_url: "https://www.riverbender.com/news/details/troy-police-conduct-extensive-labor-day-impaired-driving-enforcement-85893.cfm",
              },
            ],
            roads: ["I-55", "I-70", "U.S. Route 40", "Illinois Route 162", "Market Street"],
            jurisdictions: [
              jurisdiction("Troy Police Department", "Municipal police", "Handles city traffic stops and local crash reports within Troy."),
              jurisdiction("Madison County Sheriff's Office", "County sheriff", "May be involved outside city limits or on county roads."),
              jurisdiction("Illinois State Police", "State police", "May handle interstate and state-route enforcement."),
            ],
          }),
        },
      ],
    },
    {
      slug: "st-charles-county-mo",
      name: "St. Charles County",
      state: "Missouri",
      stateCode: "MO",
      teaser: "West of St. Louis, with five city hubs and two practice areas.",
      urgentDeadline: {
        headline: "Missouri DWI cases can trigger a separate driver-license track quickly.",
        body: "In St. Charles County, drivers often need to think about the circuit court case and Missouri Department of Revenue consequences on parallel timelines.",
      },
      regionHighlights: [
        {
          title: "One county, several growth corridors",
          body: "This cluster covers fast-growing communities tied together by I-70, Highway K, and the western St. Charles County development corridor, which means traffic enforcement patterns can differ sharply by city.",
        },
        {
          title: "The county seat still drives the court path",
          body: "Even for O'Fallon, Wentzville, and Lake Saint Louis readers, the county court anchor stays in St. Charles, so the regional page helps explain the shared court system.",
        },
        {
          title: "License logistics are spread out",
          body: "Some drivers are closer to O'Fallon or Wentzville license offices while others are closer to St. Charles, which makes a county-level orientation page more useful than a single-city view.",
        },
        {
          title: "Municipal police are not interchangeable",
          body: "The cluster uses separate city departments, so report retrieval and local records questions can change even when the court system is shared.",
        },
      ],
      processNotes: [
        {
          label: "Court anchor",
          title: "The criminal court path still funnels back to St. Charles",
          body: "Readers can use the region page to connect western and central county cities to the same circuit-court structure before relying on city-level details.",
        },
        {
          label: "High-growth suburbs",
          title: "Traffic corridors can change which police agency starts the case",
          body: "Stops near I-70 or major connector roads can feel more regional than purely neighborhood-based, which is why the cluster page carries extra value.",
        },
        {
          label: "License offices",
          title: "Western county drivers may use different DOR touchpoints",
          body: "O'Fallon and Wentzville readers often care less about the county seat than about the closest workable license-office counter, so this page keeps both layers visible.",
        },
      ],
      court: {
        name: "St. Charles County Circuit Court",
        address: "300 N. Second Street, St. Charles, MO 63301",
        phone: "(636) 949-3080",
        hours: "Monday-Friday, 8:00 am-5:00 pm",
        courtSystem: "11th Judicial Circuit",
        href: "https://www.courts.mo.gov/page.jsp?id=321",
      },
      licenseOffice: {
        name: "St. Charles License Office",
        type: "Missouri License Office",
        address: "2499 Raymond Drive, St. Charles, MO 63301",
        phone: "(636) 946-4456",
        hours: "Confirm current hours with the Missouri Department of Revenue office locator.",
        href: "https://dor.mo.gov/license-office-locator/",
        note: "Missouri DOR offices handle driver-license transactions and can confirm the correct location before a visit.",
      },
      cities: [
        {
          slug: "lake-saint-louis-mo",
          name: "Lake Saint Louis",
          agency: "Lake Saint Louis Police Department",
          police: {
            name: "Lake Saint Louis Police Department",
            type: "Municipal Police",
            address: "200 Civic Center Drive, Lake Saint Louis, MO 63367",
            phone: "(636) 625-8018",
            href: "https://www.lakesaintlouis.com/154/Police",
            note: "For city police records, crash reports, and law-enforcement questions inside Lake Saint Louis.",
          },
          licenseOfficeOverride: {
            name: "Wentzville License Office",
            type: "Missouri License Office",
            address: "807-B E. Pearce Boulevard, Wentzville, MO 63385",
            phone: "(636) 445-5053",
            hours: "Confirm current hours with the Missouri Department of Revenue office locator.",
            href: "https://dor.mo.gov/license-office-locator/",
            note: "Nearest listed Missouri DOR license-office option for many western St. Charles County drivers.",
          },
        },
        {
          slug: "ofallon-mo",
          name: "O'Fallon",
          agency: "O'Fallon Police Department",
          police: {
            name: "O'Fallon Police Department",
            type: "Municipal Police",
            address: "1019 Bryan Road, O'Fallon, MO 63366",
            phone: "(636) 240-3200",
            href: "https://www.ofallon.mo.us/police",
            note: "For city police reports, local crash records, and O'Fallon law-enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "O'Fallon Police publish annual reports and identify patrol and traffic-related operations through the department's official site.",
            sourceName: "O'Fallon Police Department annual report page",
            sourceUrl: "https://www.ofallon.mo.us/annual-report",
            roads: ["I-70", "Highway K", "Bryan Road", "Mexico Road", "Veterans Memorial Parkway"],
            jurisdictions: [
              jurisdiction("O'Fallon Police Department", "Municipal police", "Handles city traffic stops and local crash reports inside O'Fallon."),
              jurisdiction("St. Charles County Sheriff's Department", "County sheriff", "May be involved outside city limits or on county-level matters."),
              jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway crashes, DWI arrests, and traffic enforcement on state routes."),
            ],
          }),
          licenseOfficeOverride: {
            name: "O'Fallon License Office",
            type: "Missouri License Office",
            address: "2421 Highway K, O'Fallon, MO 63368",
            phone: "(636) 394-5829",
            hours: "Confirm current hours with the Missouri Department of Revenue office locator.",
            href: "https://dor.mo.gov/license-office-locator/",
            note: "Missouri DOR license office serving O'Fallon-area driver-license and motor-vehicle transactions.",
          },
        },
        {
          slug: "st-charles-mo",
          name: "St. Charles",
          agency: "St. Charles Police Department",
          police: {
            name: "St. Charles Police Department",
            type: "Municipal Police",
            address: "1781 Zumbehl Road, St. Charles, MO 63303",
            phone: "(636) 949-3300",
            href: "https://www.stcharlescitymo.gov/166/Police",
            note: "For city police records, traffic crash reports, and local law-enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "The St. Charles Police Department publishes annual reports, including 2024 statistics on calls for service, incident reports, arrests, citations, and traffic crashes.",
            sourceName: "St. Charles Police Department 2024 Annual Report",
            sourceUrl: "https://www.stcharlescitymo.gov/DocumentCenter/View/13699/2024-Annual-Report",
            sourceDate: "2024",
            arrestSummary:
              "The 2024 St. Charles Police annual report includes arrest and citation data; the department's official police page also links annual reports from 2018 through 2024.",
            arrestYear: "2024",
            roads: ["I-70", "Route 94", "Fifth Street", "Zumbehl Road", "First Capitol Drive"],
            jurisdictions: [
              jurisdiction("St. Charles Police Department", "Municipal police", "Handles city traffic stops and crash reports within St. Charles."),
              jurisdiction("St. Charles County Sheriff's Department", "County sheriff", "May be involved outside municipal limits or in county-level enforcement."),
              jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway enforcement and crash investigations on state routes."),
            ],
          }),
        },
        {
          slug: "st-peters-mo",
          name: "St. Peters",
          agency: "St. Peters Police Department",
          police: {
            name: "St. Peters Police Department",
            type: "Municipal Police",
            address: "1020 Grand Teton Drive, St. Peters, MO 63376",
            phone: "(636) 278-2222",
            href: "https://www.stpetersmo.net/254/Police-Department",
            note: "For St. Peters police reports, local crash records, and municipal enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "The St. Peters Police Department publishes annual reports that include crime statistics, organizational summaries, department goals, and other police activity information.",
            sourceName: "St. Peters Police Department annual reports",
            sourceUrl: "https://www.stpetersmo.net/187/Annual-Report",
            roads: ["I-70", "Mexico Road", "Mid Rivers Mall Drive", "Salt River Road", "Spencer Road"],
            jurisdictions: [
              jurisdiction("St. Peters Police Department", "Municipal police", "Handles city traffic stops and local crash reports inside St. Peters."),
              jurisdiction("St. Charles County Sheriff's Department", "County sheriff", "May be involved outside city limits or on county matters."),
              jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle interstate and state-route enforcement."),
            ],
          }),
        },
        {
          slug: "wentzville-mo",
          name: "Wentzville",
          agency: "Wentzville Police Department",
          police: {
            name: "Wentzville Police Department",
            type: "Municipal Police",
            address: "1019 Schroeder Creek Boulevard, Wentzville, MO 63385",
            phone: "(636) 327-5105",
            href: "https://www.wentzvillemo.gov/police/",
            note: "For Wentzville police records, local crash reports, and city enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "The Wentzville Police Department publishes annual reports with statistical data and year-over-year comparisons for department activity.",
            sourceName: "Wentzville Police Department annual reports",
            sourceUrl: "https://www.wentzvillemo.gov/police/welcome-to-wpd/about-wpd/wpd-annual-report/",
            roads: ["I-70", "I-64", "U.S. Route 61", "Wentzville Parkway", "Pearce Boulevard"],
            jurisdictions: [
              jurisdiction("Wentzville Police Department", "Municipal police", "Handles city traffic stops and local crash reports inside Wentzville."),
              jurisdiction("St. Charles County Sheriff's Department", "County sheriff", "May be involved outside municipal limits or in county-level enforcement."),
              jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle highway crashes and DWI enforcement on I-70, I-64, and U.S. 61."),
            ],
          }),
          licenseOfficeOverride: {
            name: "Wentzville License Office",
            type: "Missouri License Office",
            address: "807-B E. Pearce Boulevard, Wentzville, MO 63385",
            phone: "(636) 445-5053",
            hours: "Confirm current hours with the Missouri Department of Revenue office locator.",
            href: "https://dor.mo.gov/license-office-locator/",
            note: "Missouri DOR license office serving Wentzville-area driver-license and motor-vehicle transactions.",
          },
        },
      ],
    },
    {
      slug: "west-st-louis-county-mo",
      name: "West St. Louis County",
      state: "Missouri",
      stateCode: "MO",
      teaser: "West County guides for suburban cities tied to the St. Louis County court system.",
      urgentDeadline: {
        headline: "West County DWI timing is local on the front end but county-wide in the court system.",
        body: "Drivers often start with a city or precinct-level police question and then shift quickly into the larger St. Louis County court and license process.",
      },
      regionHighlights: [
        {
          title: "Manchester Road and I-64 shape the region",
          body: "Ballwin, Ellisville, Manchester, Chesterfield, and Wildwood share major commuter corridors, which means enforcement often follows the same traffic spine even when city boundaries change quickly.",
        },
        {
          title: "County court, suburban records",
          body: "This cluster is a good example of why a region page matters: local police contacts vary by suburb, but the court path still pulls readers back toward Clayton and the county system.",
        },
        {
          title: "Wildwood has a different policing setup",
          body: "Wildwood relies on St. Louis County Police rather than a standalone municipal department, which makes the regional explanation more important than a city-only template would suggest.",
        },
        {
          title: "License logistics stay practical",
          body: "The West County license office is often a more useful next step for drivers than the courthouse itself when the immediate question is about reinstatement or documents.",
        },
      ],
      processNotes: [
        {
          label: "Suburban overlap",
          title: "City boundaries change fast in West County",
          body: "Readers can move from one municipality to another in minutes, so it helps to confirm which department handled the stop or crash before requesting records.",
        },
        {
          label: "County pull",
          title: "The case path usually gets bigger than the city",
          body: "Even when a Ballwin or Chesterfield officer starts the case, the next steps often require county-court navigation and county-level timing awareness.",
        },
        {
          label: "Wildwood exception",
          title: "Some cities in this cluster do not fit the same policing model",
          body: "Wildwood readers, in particular, benefit from the region page because local enforcement runs through St. Louis County Police rather than a city force.",
        },
      ],
      court: {
        name: "St. Louis County Circuit Court",
        address: "105 S. Central Avenue, Clayton, MO 63105",
        phone: "(314) 615-8029",
        hours: "Monday-Friday, 8:00 am-5:00 pm",
        courtSystem: "21st Judicial Circuit",
        href: "https://stlcountycourts.com/",
      },
      licenseOffice: {
        name: "West County License Office",
        type: "Missouri License Office",
        address: "15533 Manchester Road, Ballwin, MO 63011",
        phone: "(636) 230-5041",
        hours: "Confirm current hours with the Missouri Department of Revenue office locator.",
        href: "https://dor.mo.gov/license-office-locator/",
        note: "Missouri DOR license office serving many West County driver-license and motor-vehicle transactions.",
      },
      cities: [
        {
          slug: "ballwin-mo",
          name: "Ballwin",
          agency: "Ballwin Police Department",
          police: {
            name: "Ballwin Police Department",
            type: "Municipal Police",
            address: "302 Kehrs Mill Road, Ballwin, MO 63011",
            phone: "(636) 227-9000",
            href: "https://ballwin.mo.us/Contact-Us/",
            note: "For Ballwin police reports, crash records, and municipal enforcement questions.",
          },
        },
        {
          slug: "chesterfield-mo",
          name: "Chesterfield",
          agency: "Chesterfield Police Department",
          police: {
            name: "Chesterfield Police Department",
            type: "Municipal Police",
            address: "690 Chesterfield Parkway W., Chesterfield, MO 63017",
            phone: "(636) 537-3000",
            href: "https://www.chesterfield.mo.us/police-department.html",
            note: "For Chesterfield police reports, crash records, and local enforcement questions.",
          },
        },
        {
          slug: "ellisville-mo",
          name: "Ellisville",
          agency: "Ellisville Police Department",
          police: {
            name: "Ellisville Police Department",
            type: "Municipal Police",
            address: "1 Weis Avenue, Ellisville, MO 63011",
            phone: "(636) 227-7777",
            href: "https://www.ellisville.mo.us/Directory.aspx?did=9",
            note: "For Ellisville police reports, crash records, and local enforcement questions.",
          },
        },
        {
          slug: "manchester-mo",
          name: "Manchester",
          agency: "Manchester Police Department",
          police: {
            name: "Manchester Police Department",
            type: "Municipal Police",
            address: "200 Highlands Boulevard Drive, Manchester, MO 63011",
            phone: "(636) 227-1410",
            href: "https://www.manchestermo.gov/160/Police",
            note: "For Manchester police records, local crash reports, and city enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Manchester's official police page identifies traffic enforcement and auto accident investigation among the services provided by the department.",
            sourceName: "Manchester Police Department",
            sourceUrl: "https://www.manchestermo.gov/160/Police",
            arrestSummary:
              "Manchester's 2023 year-end police report listed 40 DWI entries within traffic-related issues, along with traffic surveys, complaints, grants, towed autos, and careless-and-imprudent driving categories.",
            arrestYear: "2023",
            arrestSourceName: "Manchester Police year-end report",
            arrestSourceUrl: "https://manchestermo.gov/DocumentCenter/View/6603/Year-End-Report",
            roads: ["Manchester Road", "Highlands Boulevard Drive", "Big Bend Road", "Sulphur Spring Road", "I-270"],
            jurisdictions: [
              jurisdiction("Manchester Police Department", "Municipal police", "Handles city traffic stops, crash reports, and municipal enforcement inside Manchester."),
              jurisdiction("St. Louis County Police Department", "County police", "May be involved in nearby county areas or regional enforcement support."),
              jurisdiction("Missouri State Highway Patrol", "State patrol", "May handle state-route or highway enforcement and crash investigations."),
            ],
          }),
        },
        {
          slug: "wildwood-mo",
          name: "Wildwood",
          agency: "St. Louis County Police Department",
          police: {
            name: "St. Louis County Police Department - West County Precinct",
            type: "County Police",
            address: "232 Vance Road Suite 101, Valley Park, MO 63088",
            phone: "(314) 615-0700",
            href: "https://www.stlouiscountypolice.com/precincts/west-county/",
            note: "Wildwood does not operate a separate municipal police department; St. Louis County Police provide local coverage.",
          },
        },
      ],
    },
    {
      slug: "charlotte-south-nc",
      name: "Charlotte South",
      state: "North Carolina",
      stateCode: "NC",
      teaser: "South Charlotte community guides covering a compact, fast-moving legal market.",
      urgentDeadline: {
        headline: "North Carolina DWI consequences can start immediately after the stop.",
        body: "In the Charlotte South cluster, the early pressure point is often sorting out which county court and DMV path apply before deadlines or revocation issues start stacking up.",
      },
      regionHighlights: [
        {
          title: "Two counties inside one sponsorable market",
          body: "This cluster mixes Mecklenburg-based communities with Indian Trail in Union County, which creates a stronger business package but also means court and sheriff paths are not identical.",
        },
        {
          title: "Charlotte traffic corridors shape local demand",
          body: "I-485, South Boulevard, Providence Road, and Monroe-area commuter routes create a dense pattern of stops, crashes, and records questions across a relatively compact geography.",
        },
        {
          title: "CMPD and county coverage both matter",
          body: "Ballantyne depends on Charlotte-Mecklenburg Police, while Indian Trail uses the Union County Sheriff's Office, so readers need region context before a city page alone makes full sense.",
        },
        {
          title: "Court location depends on the side of the market",
          body: "Matthews, Pineville, and Ballantyne readers typically orient around Mecklenburg County, while Indian Trail points readers toward Union County in Monroe.",
        },
      ],
      processNotes: [
        {
          label: "County split",
          title: "Start by confirming whether Mecklenburg or Union County controls the case",
          body: "That one distinction changes the courthouse, the clerk path, and often the fastest way to verify court information.",
        },
        {
          label: "Regional commuting",
          title: "This market acts more like one traffic zone than four isolated towns",
          body: "People drive these communities interchangeably, so a regional overview helps users and potential sponsors understand why one package covers all four cities.",
        },
        {
          label: "DMV and court timing",
          title: "DMV questions can become urgent before the court process feels clear",
          body: "That is especially true in North Carolina, where readers often want the right DMV office and the right courthouse in the same first conversation.",
        },
      ],
      licenseOffice: {
        name: "NCDMV Driver License Office - Charlotte South",
        type: "NCDMV Driver License Office",
        address: "201-H W. Arrowood Road, Charlotte, NC 28217",
        phone: "(704) 527-2562",
        hours: "Confirm current hours with the NCDMV office locator.",
        href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
        note: "Use the NCDMV locator to verify wait times, hours, and whether an appointment is required.",
      },
      cities: [
        {
          slug: "ballantyne-nc",
          name: "Ballantyne",
          agency: "Charlotte-Mecklenburg Police Department",
          police: {
            name: "Charlotte-Mecklenburg Police Department - South Division",
            type: "Municipal Police",
            address: "8050 Corporate Center Drive, Charlotte, NC 28226",
            phone: "(704) 336-3000",
            href: "https://www.charlottenc.gov/cmpd/Organization/Patrol-Divisions/South-Division",
            note: "Ballantyne is within Charlotte-Mecklenburg Police Department service territory; confirm the responding division for a specific incident.",
          },
          dui_local_data: duiData({
            summary:
              "Charlotte-Mecklenburg Police publish annual and quarterly statistical reports; CMPD's 2025 annual report describes weekly speed, reckless-driving, and DWI enforcement operations on high-injury networks.",
            sourceName: "CMPD 2025 Annual Report",
            sourceUrl: "https://www.charlottenc.gov/files/sharedassets/police/v/2/newsroom/article_documents/2025_cmpd_annual_report-final.pdf",
            sourceDate: "2025",
            arrestSummary:
              "CMPD reported 72 combined traffic operations in 2025, including DWI task-force activity, 4,840 traffic stops, 5,756 violations, and 782 DWI charges across the Charlotte-Mecklenburg jurisdiction.",
            arrestYear: "2025",
            roads: ["I-485", "Johnston Road", "Providence Road West", "Ballantyne Commons Parkway", "Lancaster Highway"],
            jurisdictions: [
              jurisdiction("Charlotte-Mecklenburg Police Department - South Division", "Municipal police", "Primary local police reference for Ballantyne-area stops and crash reports."),
              jurisdiction("Mecklenburg County Sheriff's Office", "County sheriff", "May be involved in court security, custody, or county-level processes."),
              jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway crashes and impaired-driving enforcement on state routes and interstates."),
            ],
          }),
          courtOverride: {
            name: "Mecklenburg County Courthouse",
            address: "832 E. Fourth Street, Charlotte, NC 28202",
            phone: "(704) 686-0400",
            hours: "Monday-Friday, 9:00 am-5:00 pm",
            courtSystem: "North Carolina Judicial Branch",
            href: "https://www.nccourts.gov/locations/mecklenburg-county/mecklenburg-county-courthouse",
          },
        },
        {
          slug: "indian-trail-nc",
          name: "Indian Trail",
          agency: "Union County Sheriff's Office",
          police: {
            name: "Union County Sheriff's Office",
            type: "County Sheriff",
            address: "3344 Presson Road, Monroe, NC 28112",
            phone: "(704) 283-3789",
            href: "https://www.unioncountysheriffsoffice.com/",
            note: "Indian Trail contracts with the Union County Sheriff's Office for local law-enforcement services.",
          },
          courtOverride: {
            name: "Union County Judicial Center",
            address: "400 N. Main Street, Monroe, NC 28112",
            phone: "(704) 698-3100",
            hours: "Monday-Friday, 8:30 am-5:00 pm",
            courtSystem: "North Carolina Judicial Branch",
            href: "https://www.nccourts.gov/locations/union-county/union-county-judicial-center",
          },
          licenseOfficeOverride: {
            name: "NCDMV Driver License Office - Monroe",
            type: "NCDMV Driver License Office",
            address: "3122 W. Highway 74, Monroe, NC 28110",
            phone: "(704) 283-4264",
            hours: "Confirm current hours with the NCDMV office locator.",
            href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
            note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
          },
        },
        {
          slug: "matthews-nc",
          name: "Matthews",
          agency: "Matthews Police Department",
          police: {
            name: "Matthews Police Department",
            type: "Municipal Police",
            address: "1201 Crews Road, Matthews, NC 28105",
            phone: "(704) 847-5555",
            href: "https://www.matthewsnc.gov/pview.aspx?id=20710",
            note: "For Matthews police records, crash reports, and local law-enforcement questions.",
          },
          courtOverride: {
            name: "Mecklenburg County Courthouse",
            address: "832 E. Fourth Street, Charlotte, NC 28202",
            phone: "(704) 686-0400",
            hours: "Monday-Friday, 9:00 am-5:00 pm",
            courtSystem: "North Carolina Judicial Branch",
            href: "https://www.nccourts.gov/locations/mecklenburg-county/mecklenburg-county-courthouse",
          },
        },
        {
          slug: "pineville-nc",
          name: "Pineville",
          agency: "Pineville Police Department",
          police: {
            name: "Pineville Police Department",
            type: "Municipal Police",
            address: "427 Main Street, Pineville, NC 28134",
            phone: "(704) 889-2231",
            href: "https://www.pinevillenc.gov/government/departments/police/",
            note: "For Pineville police records, crash reports, and city enforcement questions.",
          },
          courtOverride: {
            name: "Mecklenburg County Courthouse",
            address: "832 E. Fourth Street, Charlotte, NC 28202",
            phone: "(704) 686-0400",
            hours: "Monday-Friday, 9:00 am-5:00 pm",
            courtSystem: "North Carolina Judicial Branch",
            href: "https://www.nccourts.gov/locations/mecklenburg-county/mecklenburg-county-courthouse",
          },
        },
      ],
    },
    {
      slug: "raleigh-north-nc",
      name: "Raleigh North",
      state: "North Carolina",
      stateCode: "NC",
      teaser: "North Raleigh suburbs with separate district and DMV touchpoints.",
      urgentDeadline: {
        headline: "Wake County DWI paperwork can feel centralized even when the stop happened in the suburbs.",
        body: "North Raleigh, Wake Forest, Rolesville, and Knightdale readers still need a fast read on the Wake County court path and DMV consequences.",
      },
      regionHighlights: [
        {
          title: "One county, different suburban entry points",
          body: "Knightdale, Rolesville, Wake Forest, and North Raleigh all feed into Wake County systems, but they sit on different commuter and enforcement corridors including I-540, Capital Boulevard, and US-1.",
        },
        {
          title: "Wake County centralization matters",
          body: "Many criminal-case questions point back to the Wake County Justice Center, while civil matters may point to the Wake County Courthouse, which is why the region page works as a bridge between suburb-level searches and county-level procedure.",
        },
        {
          title: "DMV and court are not in the same place",
          body: "The county court anchor and the driver-license office are different trips with different workflows, so the regional page helps readers keep those systems separate.",
        },
        {
          title: "Fast-growth suburbs change local search intent",
          body: "People often search by town first, but the real next steps can be county-based, especially for DWI court dates, records, and license questions.",
        },
      ],
      processNotes: [
        {
          label: "Wake County hub",
          title: "Use the Justice Center as the county-wide court reference",
          body: "Even when the police contact happened in Rolesville or Wake Forest, the regional page helps explain the shared county court path.",
        },
        {
          label: "Corridor differences",
          title: "Major roads can change the first agency involved",
          body: "Stops near major commuter corridors can involve different local departments, so the city page still matters after the regional orientation step.",
        },
        {
          label: "Separate trips",
          title: "Court and DMV tasks usually require different planning",
          body: "The region page keeps that practical distinction visible instead of letting readers assume every next step happens in one building.",
        },
      ],
      court: {
        name: "Wake County Justice Center",
        address: "300 S. Salisbury Street, Raleigh, NC 27601",
        phone: "(919) 792-4000",
        hours: "Monday-Friday, 8:30 am-5:00 pm",
        courtSystem: "North Carolina Judicial Branch",
        href: "https://www.nccourts.gov/locations/wake-county/wake-county-justice-center",
      },
      personalInjuryCourt: {
        name: "Wake County Courthouse",
        address: "316 Fayetteville Street Mall, Raleigh, NC 27601",
        phone: "(919) 792-4000",
        hours: "Monday-Friday, 8:30 am-5:00 pm",
        courtSystem: "North Carolina Judicial Branch",
        href: "https://www.nccourts.gov/locations/wake-county/wake-county-courthouse",
      },
      licenseOffice: {
        name: "NCDMV Driver License Office - Raleigh",
        type: "NCDMV Driver License Office",
        address: "2431 Spring Forest Road, Raleigh, NC 27615",
        phone: "(919) 855-6877",
        hours: "Confirm current hours with the NCDMV office locator.",
        href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
        note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
      },
      cities: [
        {
          slug: "knightdale-nc",
          name: "Knightdale",
          agency: "Knightdale Police Department",
          police: {
            name: "Knightdale Police Department",
            type: "Municipal Police",
            address: "979 Steeple Square Court, Knightdale, NC 27545",
            phone: "(919) 217-2261",
            href: "https://www.knightdalenc.gov/departments/police",
            note: "For Knightdale police reports, crash records, and local enforcement questions.",
          },
        },
        {
          slug: "north-raleigh-nc",
          name: "North Raleigh",
          agency: "Raleigh Police Department",
          local_context_intro:
            "This guide focuses on DWI cases connected to North Raleigh, including Raleigh Police traffic stops, Wake County court paperwork, and NCDMV license questions involving I-540, U.S. 1/Capital Boulevard, Six Forks Road, Falls of Neuse Road, Creedmoor Road, and Glenwood Avenue.",
          common_roads: ["I-540", "U.S. 1/Capital Boulevard", "Six Forks Road", "Falls of Neuse Road", "Creedmoor Road", "Glenwood Avenue"],
          police: {
            name: "Raleigh Police Department",
            type: "Municipal Police",
            address: "6716 Six Forks Road, Raleigh, NC 27615",
            phone: "(919) 996-3335",
            href: "https://raleighnc.gov/police",
            note: "For Raleigh police reports, crash records, and city enforcement questions in North Raleigh.",
          },
        },
        {
          slug: "rolesville-nc",
          name: "Rolesville",
          agency: "Rolesville Police Department",
          police: {
            name: "Rolesville Police Department",
            type: "Municipal Police",
            address: "502 Southtown Circle, Rolesville, NC 27571",
            phone: "(919) 554-7222",
            href: "https://www.rolesvillenc.gov/police",
            note: "For Rolesville police records, crash reports, and local enforcement questions.",
          },
        },
        {
          slug: "wake-forest-nc",
          name: "Wake Forest",
          agency: "Wake Forest Police Department",
          police: {
            name: "Wake Forest Police Department",
            type: "Municipal Police",
            address: "225 S. Taylor Street, Wake Forest, NC 27587",
            phone: "(919) 554-6150",
            href: "https://www.wakeforestnc.gov/police",
            note: "For Wake Forest police reports, crash records, and local enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Wake Forest Police publish a Traffic Enforcement Unit page describing a DWI Traffic Team focused on impaired-driving enforcement in town.",
            sourceName: "Wake Forest Police Traffic Enforcement Unit",
            sourceUrl: "https://www.wakeforestnc.gov/police/operations/special-operations/impact-division/traffic-enforcement-unit",
            arrestSummary:
              "In July 2024, Wake Forest Police reported 10 DWI arrests over one weekend, 19 since July 1, and 103 DWI arrests for the year to that point.",
            arrestYear: "2024",
            arrestSourceName: "Wake Forest Police DWI enforcement release",
            arrestSourceUrl: "https://www.wakeforestnc.gov/news/wake-forest-police-warn-motorists-not-drink-drive-after-10-dwi-weekend-arrests",
            roads: ["Capital Boulevard", "U.S. 1", "NC 98", "S. Main Street", "Rogers Road"],
            jurisdictions: [
              jurisdiction("Wake Forest Police Department", "Municipal police", "Handles local traffic stops, DWI enforcement, and crash reports inside Wake Forest."),
              jurisdiction("Wake County Sheriff's Office", "County sheriff", "May be involved outside town limits or in county-level processes."),
              jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle state-route and highway enforcement."),
            ],
          }),
        },
      ],
    },
    {
      slug: "wake-southwest-nc",
      name: "Wake Southwest",
      state: "North Carolina",
      stateCode: "NC",
      teaser: "Wake County south and southwest city guides tied to the county court and state agency systems.",
      urgentDeadline: {
        headline: "Wake Southwest DWI cases can feel local at the stop and county-wide by the next morning.",
        body: "Apex, Cary, Holly Springs, and Fuquay-Varina readers often need both the Wake County court path and the right DMV office immediately.",
      },
      regionHighlights: [
        {
          title: "Rapid-growth triangle suburbs",
          body: "Apex, Cary, Holly Springs, and Fuquay-Varina sit along fast-moving Triangle commuter corridors where population growth, heavy driving, and overlapping travel patterns create steady local search demand.",
        },
        {
          title: "Wake County court system is the common thread",
          body: "Although each town has its own police department, the court path still points back to Wake County court offices in Raleigh, giving the cluster real shared logic beyond pure geography.",
        },
        {
          title: "DMV convenience changes by city",
          body: "Cary and Fuquay-Varina have different practical DMV touchpoints, so city pages matter, but the region page still helps readers understand the larger county process first.",
        },
        {
          title: "Town identity stays strong",
          body: "These towns are close together but not interchangeable, which is why a strong sponsor package benefits from both a county-level page and city-level guides.",
        },
      ],
      processNotes: [
        {
          label: "Shared county court",
          title: "Wake County is the unifying process layer",
          body: "This cluster works well because local police vary by town while court scheduling and broader case structure still run through the same county system.",
        },
        {
          label: "Southwest DMV choices",
          title: "Drivers often care about the nearest workable DMV office, not just the county seat",
          body: "That is why the city pages keep their own office references even while the regional page explains the shared legal path.",
        },
        {
          label: "Commuter market",
          title: "The region reflects how people actually move through southwest Wake",
          body: "Residents commute between these towns constantly, so one sponsor package across all four cities feels intuitive instead of forced.",
        },
      ],
      court: {
        name: "Wake County Justice Center",
        address: "300 S. Salisbury Street, Raleigh, NC 27601",
        phone: "(919) 792-4000",
        hours: "Monday-Friday, 8:30 am-5:00 pm",
        courtSystem: "North Carolina Judicial Branch",
        href: "https://www.nccourts.gov/locations/wake-county/wake-county-justice-center",
      },
      personalInjuryCourt: {
        name: "Wake County Courthouse",
        address: "316 Fayetteville Street Mall, Raleigh, NC 27601",
        phone: "(919) 792-4000",
        hours: "Monday-Friday, 8:30 am-5:00 pm",
        courtSystem: "North Carolina Judicial Branch",
        href: "https://www.nccourts.gov/locations/wake-county/wake-county-courthouse",
      },
      licenseOffice: {
        name: "NCDMV Driver License Office - Raleigh",
        type: "NCDMV Driver License Office",
        address: "3231 Avent Ferry Road, Raleigh, NC 27606",
        phone: "(919) 816-9128",
        hours: "Confirm current hours with the NCDMV office locator.",
        href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
        note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
      },
      cities: [
        {
          slug: "apex-nc",
          name: "Apex",
          agency: "Apex Police Department",
          police: {
            name: "Apex Police Department",
            type: "Municipal Police",
            address: "205 Saunders Street, Apex, NC 27502",
            phone: "(919) 362-8661",
            href: "https://www.apexnc.org/261/Police-Department",
            note: "For Apex police reports, crash records, and local enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Apex Police publish annual statistical reports and maintain records-office guidance for police and accident reports.",
            sourceName: "Apex Police Department",
            sourceUrl: "https://www.apexnc.org/261/Police-Department",
            sourceDate: "2023 statistical report listed on official police page",
            roads: ["U.S. 64", "NC 55", "Apex Peakway", "Salem Street", "Ten Ten Road"],
            jurisdictions: [
              jurisdiction("Apex Police Department", "Municipal police", "Handles local traffic stops and crash reports inside Apex."),
              jurisdiction("Wake County Sheriff's Office", "County sheriff", "May be involved outside town limits or on county matters."),
              jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle state-route and highway enforcement."),
            ],
          }),
          licenseOfficeOverride: {
            name: "NCDMV Driver License Office - Cary",
            type: "NCDMV Driver License Office",
            address: "1387 SE Maynard Road, Cary, NC 27511",
            phone: "(919) 468-0319",
            hours: "Confirm current hours with the NCDMV office locator.",
            href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
            note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
          },
        },
        {
          slug: "cary-nc",
          name: "Cary",
          agency: "Cary Police Department",
          police: {
            name: "Cary Police Department",
            type: "Municipal Police",
            address: "120 Wilkinson Avenue, Cary, NC 27513",
            phone: "(919) 469-4012",
            href: "https://www.carync.gov/services-publications/police",
            note: "For Cary police reports, crash records, and local enforcement questions.",
          },
          dui_local_data: duiData({
            summary:
              "Cary Police publish annual reports, maintain Police 2 Citizen report access, and provide public crash-data resources through Cary's open-data portal.",
            sourceName: "Town of Cary Police",
            sourceUrl: "https://www.carync.gov/services-publications/police",
            crashSummary:
              "Cary's public crash dataset contains crash information from the last five years to the current date and notes that the data is dynamic as reports are updated.",
            crashSourceName: "Cary Police crash data",
            crashSourceUrl: "https://data.carync.gov/explore/dataset/cpd-crash-incidents/",
            roads: ["U.S. 1", "U.S. 64", "NC 55", "Kildaire Farm Road", "Maynard Road"],
            jurisdictions: [
              jurisdiction("Cary Police Department", "Municipal police", "Handles Cary traffic stops, crash reports, and local enforcement questions."),
              jurisdiction("Wake County Sheriff's Office", "County sheriff", "May be involved outside town limits or in county-level processes."),
              jurisdiction("North Carolina State Highway Patrol", "State patrol", "May handle highway and state-route enforcement."),
            ],
          }),
          licenseOfficeOverride: {
            name: "NCDMV Driver License Office - Cary",
            type: "NCDMV Driver License Office",
            address: "1387 SE Maynard Road, Cary, NC 27511",
            phone: "(919) 468-0319",
            hours: "Confirm current hours with the NCDMV office locator.",
            href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
            note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
          },
        },
        {
          slug: "fuquay-varina-nc",
          name: "Fuquay-Varina",
          agency: "Fuquay-Varina Police Department",
          police: {
            name: "Fuquay-Varina Police Department",
            type: "Municipal Police",
            address: "401 Old Honeycutt Road, Fuquay-Varina, NC 27526",
            phone: "(919) 552-3191",
            href: "https://www.fuquay-varina.org/223/Police",
            note: "For Fuquay-Varina police reports, crash records, and local enforcement questions.",
          },
          licenseOfficeOverride: {
            name: "NCDMV Driver License Office - Fuquay-Varina",
            type: "NCDMV Driver License Office",
            address: "131 S. Fuquay Avenue, Fuquay-Varina, NC 27526",
            phone: "(919) 552-1895",
            hours: "Confirm current hours with the NCDMV office locator.",
            href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
            note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
          },
        },
        {
          slug: "holly-springs-nc",
          name: "Holly Springs",
          agency: "Holly Springs Police Department",
          police: {
            name: "Holly Springs Police Department",
            type: "Municipal Police",
            address: "750 Holly Springs Road, Holly Springs, NC 27540",
            phone: "(919) 557-9111",
            href: "https://www.hollyspringsnc.gov/318/Police",
            note: "For Holly Springs police reports, crash records, and local enforcement questions.",
          },
          licenseOfficeOverride: {
            name: "NCDMV Driver License Office - Fuquay-Varina",
            type: "NCDMV Driver License Office",
            address: "131 S. Fuquay Avenue, Fuquay-Varina, NC 27526",
            phone: "(919) 552-1895",
            hours: "Confirm current hours with the NCDMV office locator.",
            href: "https://www.ncdot.gov/dmv/offices-services/locate-dmv-office/Pages/dmv-offices.aspx",
            note: "Use the NCDMV locator to verify services, appointments, and current hours before visiting.",
          },
        },
      ],
    },
    ...expansionRegions,
  ],
};
