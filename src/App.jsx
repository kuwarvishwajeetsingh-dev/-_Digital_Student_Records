import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import IM1 from "./assets/IM1.jpeg";
import IM2 from "./assets/IM2.jpeg";
import IM3 from "./assets/IM3.jpeg";
import IM4 from "./assets/IM4.jpeg";
import IM5 from "./assets/IM5.jpeg";
import IM6 from "./assets/IM6.jpeg";
import "./App.css";

const TEMP_CAMPUS_IMAGES = [
  IM1, IM2, IM3, IM4, IM5, IM6
];

const SPOTLIGHT_STORAGE_KEY = "abhilekh-student-spotlight";
const SPOTLIGHT_DURATION = 48 * 60 * 60 * 1000;
const DIRECTORY_PAGE_SIZE = 12;
const MAX_PHOTO_SIZE = 50 * 1024;

const ARTICLES = [
  {
    id: 1,
    category: "Campus Life",
    title: "The People Behind the Campus Pulse",
    summary: "Every corridor has a story. Meet the students turning ordinary college days into memorable ones.",
    body: "A campus is shaped by more than buildings and timetables. It grows through late-night ideas, shared notes, unexpected friendships, and the people willing to begin something new. The अभिलेख brings those stories together so the energy of student life has a place to live.",
    image: IM2,
  },
  {
    id: 2,
    category: "Student Voices",
    title: "Skills That Deserve a Bigger Stage",
    summary: "From first projects to ambitious experiments, discover the skills already growing around you.",
    body: "The most interesting talent on campus is not always on a noticeboard. It is in the student who builds after class, the designer who sees a better way, and the collaborator who connects ideas. A profile is a small introduction that can lead to a much bigger opportunity.",
    image: IM4,
  },
  {
    id: 3,
    category: "The New Register",
    title: "Why Your Name Belongs in the Record",
    summary: "A digital directory can be more than a list. It can become the first page of your campus story.",
    body: "What is written today becomes the record of tomorrow. Add your name, your branch, and the work you care about. The next collaboration, conversation, or opportunity may begin with someone finding your story in the register.",
    image: IM6,
  },
];

function App() {
  const heroRef = useRef(null);
  const studentsRef = useRef(null);
  const profileRef = useRef(null);
  const photoInputRef = useRef(null);

  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [skills, setSkills] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoCropX, setPhotoCropX] = useState(50);
  const [photoCropY, setPhotoCropY] = useState(50);
  const [students, setStudents] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyDraft, setStoryDraft] = useState("");
  const [storySaving, setStorySaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [navOpen, setNavOpen] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeNav, setActiveNav] = useState("home");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("All branches");
  const [yearFilter, setYearFilter] = useState("All classes");
  const [campusIndex, setCampusIndex] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [spotlightStudent, setSpotlightStudent] = useState(null);
  const [directoryPage, setDirectoryPage] = useState(1);

  useEffect(() => {
    if (!message.text) return;
    const timer = window.setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCampusIndex((index) => (index + 1) % TEMP_CAMPUS_IMAGES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!students.length) return undefined;
    const eligibleStudents = students.filter((student) => student.id && student.name && student.branch && student.year);
    if (!eligibleStudents.length) return undefined;

    let savedSpotlight = null;
    try {
      savedSpotlight = JSON.parse(localStorage.getItem(SPOTLIGHT_STORAGE_KEY) || "null");
    } catch {
      localStorage.removeItem(SPOTLIGHT_STORAGE_KEY);
    }

    const savedStudent = eligibleStudents.find((student) => student.id === savedSpotlight?.studentId);
    if (savedStudent && Number(savedSpotlight?.expiresAt) > Date.now()) {
      setSpotlightStudent(savedStudent);
      const timer = window.setTimeout(() => chooseNewSpotlight(eligibleStudents, savedStudent.id), Number(savedSpotlight.expiresAt) - Date.now());
      return () => window.clearTimeout(timer);
    }

    chooseNewSpotlight(eligibleStudents, savedSpotlight?.studentId);
    return undefined;
  }, [students]);

  const showMessage = (type, text) => setMessage({ type, text });

  const resetForm = () => {
    setName("");
    setBranch("");
    setYear("");
    setSkills("");
    setPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl("");
    setPhotoZoom(1);
    setPhotoCropX(50);
    setPhotoCropY(50);
    if (photoInputRef.current) photoInputRef.current.value = "";
    setEditingId(null);
  };

  const compressPhoto = (file, zoom = 1, cropX = 50, cropY = 50) => new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const targetWidth = 480;
      const targetHeight = 560;
      const frameRatio = targetWidth / targetHeight;
      const imageRatio = image.width / image.height;
      const baseCropWidth = imageRatio > frameRatio ? image.height * frameRatio : image.width;
      const baseCropHeight = imageRatio > frameRatio ? image.height : image.width / frameRatio;
      const cropWidth = baseCropWidth / zoom;
      const cropHeight = baseCropHeight / zoom;
      const sourceX = (image.width - cropWidth) * (cropX / 100);
      const sourceY = (image.height - cropHeight) * (cropY / 100);
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      for (let quality = 0.82; quality >= 0.3; quality -= 0.08) {
        canvas.getContext("2d").drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
        const blob = await new Promise((blobResolve) => canvas.toBlob(blobResolve, "image/jpeg", quality));
        if (blob && blob.size <= MAX_PHOTO_SIZE) {
          resolve(new File([blob], "profile-photo.jpg", { type: "image/jpeg" }));
          return;
        }
      }
      reject(new Error("This image could not be compressed below 50 KB."));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be read."));
    };
    image.src = objectUrl;
  });

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      event.target.value = "";
      setPhotoFile(null);
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      window.alert("This photo is larger than 50 KB. We will compress it before saving.");
    }
    try {
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
      setPhotoZoom(1);
      setPhotoCropX(50);
      setPhotoCropY(50);
    } catch (photoError) {
      window.alert(photoError.message);
      event.target.value = "";
      setPhotoFile(null);
    }
  };

  const uploadStudentPhoto = async (file, userId, studentId) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${studentId}.${extension}`;
    const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("student-photos").getPublicUrl(path).data.publicUrl;
  };

  const scrollToSection = (ref, key) => {
    setSelectedArticle(null);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (key) setActiveNav(key);
    setNavOpen(false);
  };

  const openArticle = (article) => {
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setNavOpen(false);
  };

  const openStudentProfile = (student) => {
    setSelectedStudent(student);
    setStoryDraft(stories.find((story) => story.student_id === student.id)?.story || "");
  };

  const getStudentStory = (studentId) => stories.find((story) => story.student_id === studentId)?.story || "";

  const fetchStudents = async () => {
    setLoadingStudents(true);
    const { data, error } = await supabase.from("student").select("*").order("name", { ascending: true });
    if (error) {
      showMessage("error", error.message);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
    setLoadingStudents(false);
  };

  const fetchStories = async () => {
    const { data, error } = await supabase.from("student_stories").select("student_id, user_id, story, updated_at");
    if (error) {
      showMessage("error", `Stories could not be loaded: ${error.message}`);
    } else {
      setStories(data || []);
    }
  };

  const saveStudentStory = async () => {
    if (!selectedStudent || !currentUser) return;
    const story = storyDraft.trim();
    if (!story) {
      showMessage("error", "Write a story before saving.");
      return;
    }
    setStorySaving(true);
    const { error } = await supabase.from("student_stories").upsert({
      student_id: selectedStudent.id,
      user_id: selectedStudent.user_id,
      story,
    }, { onConflict: "student_id" });
    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", "Story saved to the student record.");
      await fetchStories();
    }
    setStorySaving(false);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setCurrentUser(session?.user ?? null);
      await fetchStudents();
      await fetchStories();
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (!session?.user) resetForm();
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!name || !branch || !year || !skills) {
      showMessage("error", "Please fill all fields.");
      return;
    }
    setSubmitting(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setSubmitting(false);
      showMessage("error", "Please log in first.");
      setIsAuthOpen(true);
      setAuthMode("login");
      return;
    }
    const { data: createdStudent, error } = await supabase.from("student").insert({ user_id: user.id, name, branch, year: Number(year), skills }).select("id").single();
    if (error) showMessage("error", error.message);
    else {
      let photoUploadFailed = false;
      if (photoFile) {
        try {
          const croppedPhoto = await compressPhoto(photoFile, photoZoom, photoCropX, photoCropY);
          const photoUrl = await uploadStudentPhoto(croppedPhoto, user.id, createdStudent.id);
          const { error: photoError } = await supabase.from("student").update({ photo_url: photoUrl }).eq("id", createdStudent.id);
          if (photoError) throw photoError;
        } catch (photoError) {
          photoUploadFailed = true;
          showMessage("error", `Profile saved, but photo upload failed: ${photoError.message}`);
        }
      }
      if (!photoUploadFailed) showMessage("success", "Profile created successfully.");
      resetForm();
      await fetchStudents();
      scrollToSection(studentsRef, "students");
    }
    setSubmitting(false);
  };

  const handleUpdate = async (e) => {
    e?.preventDefault();
    if (!editingId) return;
    if (!name || !branch || !year || !skills) {
      showMessage("error", "Please fill all fields.");
      return;
    }
    setSubmitting(true);
    let photoUrl;
    if (photoFile) {
      try {
        const croppedPhoto = await compressPhoto(photoFile, photoZoom, photoCropX, photoCropY);
        photoUrl = await uploadStudentPhoto(croppedPhoto, currentUser.id, editingId);
      } catch (photoError) {
        setSubmitting(false);
        showMessage("error", `Photo upload failed: ${photoError.message}`);
        return;
      }
    }
    const updates = { name, branch, year: Number(year), skills };
    if (photoUrl) updates.photo_url = photoUrl;
    const { error } = await supabase.from("student").update(updates).eq("id", editingId);
    if (error) showMessage("error", error.message);
    else {
      showMessage("success", "Profile updated successfully.");
      resetForm();
      await fetchStudents();
      scrollToSection(studentsRef, "students");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this profile?")) return;
    const { error } = await supabase.from("student").delete().eq("id", id);
    if (error) showMessage("error", error.message);
    else {
      showMessage("success", "Profile deleted.");
      setSelectedStudent(null);
      await fetchStudents();
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) return showMessage("error", "Please enter email and password.");
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) showMessage("error", error.message);
    else {
      setEmail(""); setPassword(""); setIsAuthOpen(false);
      if (data?.session?.user) setCurrentUser(data.session.user);
      showMessage("success", "Signup successful. Check your email if confirmation is required.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return showMessage("error", "Please enter email and password.");
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) showMessage("error", error.message);
    else {
      setCurrentUser(data.user ?? data.session?.user ?? null);
      setEmail(""); setPassword(""); setIsAuthOpen(false);
      showMessage("success", "Logged in successfully.");
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showMessage("error", error.message);
    else {
      setCurrentUser(null); resetForm(); showMessage("success", "Logged out successfully.");
    }
  };

  const handleSuggestionSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const visitorName = formData.get("suggestion-name")?.toString().trim() || "Anonymous student";
    const visitorEmail = formData.get("suggestion-email")?.toString().trim() || "Not provided";
    const suggestion = formData.get("suggestion-message")?.toString().trim();
    if (!suggestion) return;
    const body = `From: ${visitorName}\nEmail: ${visitorEmail}\n\nSuggestion:\n${suggestion}`;
    window.location.href = `mailto:kuwarvishwajeetsingh@gmail.com?subject=${encodeURIComponent("Suggestion in Project--The Abhilekh")}&body=${encodeURIComponent(body)}`;
  };

  const startEdit = (student) => {
    setEditingId(student.id);
    setName(student.name);
    setBranch(student.branch);
    setYear(String(student.year));
    setSkills(student.skills);
    setSelectedStudent(null);
    scrollToSection(profileRef, "profile");
  };

  const getInitial = (value) => {
    const text = value?.trim();
    return text ? text.charAt(0).toUpperCase() : "S";
  };

  const chooseNewSpotlight = (eligibleStudents, previousId = null) => {
    const choices = eligibleStudents.length > 1 ? eligibleStudents.filter((student) => student.id !== previousId) : eligibleStudents;
    const selected = choices[Math.floor(Math.random() * choices.length)];
    const expiresAt = Date.now() + SPOTLIGHT_DURATION;
    localStorage.setItem(SPOTLIGHT_STORAGE_KEY, JSON.stringify({ studentId: selected.id, expiresAt }));
    setSpotlightStudent(selected);
  };

  const branches = useMemo(() => ["All branches", ...new Set(students.map((s) => s.branch).filter(Boolean))], [students]);
  const years = useMemo(() => { const values = [...new Set(students.map((s) => String(s.year)).filter(Boolean))].sort((a, b) => Number(a) - Number(b)); return ["All classes", ...values]; }, [students]);
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = !q || [student.name, student.branch, student.skills].some((value) => value?.toLowerCase().includes(q));
      const matchesBranch = branchFilter === "All branches" || student.branch === branchFilter;
      const matchesYear = yearFilter === "All classes" || String(student.year) === yearFilter;
      return matchesSearch && matchesBranch && matchesYear;
    });
  }, [students, search, branchFilter, yearFilter]);

  useEffect(() => {
    setDirectoryPage(1);
  }, [search, branchFilter, yearFilter]);

  const spotlightInResults = spotlightStudent && filteredStudents.some((student) => student.id === spotlightStudent.id);
  const displayedStudents = spotlightInResults ? [spotlightStudent, ...filteredStudents.filter((student) => student.id !== spotlightStudent.id)] : filteredStudents;
  const totalDirectoryPages = Math.max(1, Math.ceil(displayedStudents.length / DIRECTORY_PAGE_SIZE));
  const visiblePage = Math.min(directoryPage, totalDirectoryPages);
  const pageStudents = displayedStudents.slice((visiblePage - 1) * DIRECTORY_PAGE_SIZE, visiblePage * DIRECTORY_PAGE_SIZE);
  const featuredStudent = pageStudents[0];
  const otherStudents = pageStudents.slice(1);
  const loggedInStudent = students.find((student) => student.user_id === currentUser?.id);
  const isAdmin = currentUser?.app_metadata?.role === "admin";
  const loggedInFirstName = loggedInStudent?.name?.trim().split(/\s+/)[0] || currentUser?.email?.split("@")[0] || "Member";
  const suggestionName = loggedInStudent?.name || (currentUser?.email?.toLowerCase() === "kuwarvishwajeetsingh@gmail.com" ? "Kuwar Vishwajeet Singh..." : "");
  const thisWeekCount = students.filter((student) => {
    if (!student.created_at) return false;
    return Date.now() - new Date(student.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const latestSkillBlurb = students.length ? students[campusIndex % students.length]?.skills : "Curiosity, collaboration, and code.";
  const tickerSpotlight = spotlightStudent || featuredStudent;

  return (
    <div className="app" style={{ "--college-image": `url(${TEMP_CAMPUS_IMAGES[campusIndex]})` }}>
      <header className="navbar">
        <div className="brand-block" onClick={() => scrollToSection(heroRef, "home")}>
          <div className="logo">The अभिलेख</div>
          <div className="folio">Campus Edition · No. 01 · Est. {new Date().getFullYear()}</div>
        </div>
        <button className="hamburger" onClick={() => setNavOpen((prev) => !prev)} aria-label={navOpen ? "Close navigation" : "Open navigation"} aria-expanded={navOpen} aria-controls="primary-navigation">{navOpen ? "×" : "☰"}</button>
        <nav id="primary-navigation" className={`nav-links ${navOpen ? "open" : ""}`}>
          <button className={activeNav === "home" ? "active" : ""} onClick={() => scrollToSection(heroRef, "home")}>Home</button>
          <button className={activeNav === "students" ? "active" : ""} onClick={() => scrollToSection(studentsRef, "students")}>Directory</button>
          <button className={activeNav === "profile" ? "active" : ""} onClick={() => currentUser ? scrollToSection(profileRef, "profile") : (setAuthMode("login"), setIsAuthOpen(true))}>My Profile</button>
          {currentUser ? <><div className="user-bubble" title={currentUser.email}>{loggedInFirstName}</div><button className="login-btn" onClick={handleLogout}>Logout</button></> : <button className="login-btn" onClick={() => { setAuthMode("login"); setIsAuthOpen(true); }}>Login</button>}
        </nav>
      </header>

      <div className="ticker"><span>BREAKING · CAMPUS DIRECTORY</span>{tickerSpotlight && <button className="ticker-spotlight" type="button" onClick={() => scrollToSection(studentsRef, "students")}><span className="ticker-spotlight-label">STUDENT SPOTLIGHT · Meet {tickerSpotlight.name}</span>{tickerSpotlight.photo_url ? <span className="ticker-photo-preview"><img className="ticker-spotlight-image" src={tickerSpotlight.photo_url} alt={`${tickerSpotlight.name} profile`} /><span className="ticker-photo-banner">Spotlight · Student of the Week</span></span> : <small className="ticker-photo-status">Image not uploaded</small>}</button>}{thisWeekCount > 0 && <span>{thisWeekCount} student{thisWeekCount === 1 ? "" : "s"} joined this week</span>}<span>Updated live from the student register</span></div>

      <section className="hero" ref={heroRef}>
        <div className="fold-line" />
        <div className="hero-inner">
          <div className="hero-content">
            <p className="eyebrow">Campus Directory · Front Page</p>
            <h1>The अभिलेख</h1>
            <p className="hero-lede"><span className="drop-cap">W</span>hat is written today becomes the record of tomorrow.</p>
            <p className="hero-stat">{loadingStudents ? "Reading the latest edition…" : `${students.length} student ${students.length === 1 ? "profile is" : "profiles are"} currently on record.`}</p>
            <div className="hero-actions">
              <button className="hero-btn primary" onClick={() => scrollToSection(studentsRef, "students")}>Browse Directory</button>
              <button className="hero-btn" onClick={() => currentUser ? scrollToSection(profileRef, "profile") : (setAuthMode("login"), setIsAuthOpen(true))}>Create Profile</button>
            </div>
          </div>

          <figure className="photo-spread">
            <div className="spread-main" style={{ backgroundImage: `url(${TEMP_CAMPUS_IMAGES[campusIndex]})` }}><span>01</span></div>
            <div className="spread-side">
              <div className="spread-small" style={{ backgroundImage: `url(${TEMP_CAMPUS_IMAGES[(campusIndex + 1) % TEMP_CAMPUS_IMAGES.length]})` }}><span>02</span></div>
              <div className="spread-small" style={{ backgroundImage: `url(${TEMP_CAMPUS_IMAGES[(campusIndex + 2) % TEMP_CAMPUS_IMAGES.length]})` }}><span>03</span></div>
            </div>
            <figcaption>Campus photographs · rotating edition · CAMPUS EDITION </figcaption>
          </figure>
        </div>
      </section>

      <section className="articles-section" aria-labelledby="articles-heading">
        <div className="section-title articles-heading">
          <div><p className="section-kicker">The अभिलेख · Long Reads</p><h2 id="articles-heading">Stories from the Register</h2></div>
          <p>Ideas, people, and moments shaping campus life.</p>
        </div>
        <div className="article-grid">
          {ARTICLES.map((article) => <article className="article-card" key={article.id}>
            <button className="article-card-button" type="button" onClick={() => openArticle(article)}>
              <div className="article-image" style={{ backgroundImage: `url(${article.image})` }} aria-hidden="true" />
              <div className="article-card-content">
                <span className="article-category">{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.summary}</p>
                <span className="article-read">Read story <span aria-hidden="true">→</span></span>
              </div>
            </button>
          </article>)}
        </div>
      </section>

      <main className="content">
        <section className="section-title" ref={studentsRef}>
          <div><p className="section-kicker">Classifieds · Student Register</p><h2>Student Directory</h2></div>
          <p>Find people by name, branch, class, or skill.</p>
        </section>

        <div className="classified-bar">
          <div className="search-wrap"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the student register…" /></div>
          <div className="filter-tabs">
            <span className="filter-label">Branch</span>
            {branches.slice(0, 5).map((branchName) => <button key={branchName} className={branchFilter === branchName ? "selected" : ""} onClick={() => setBranchFilter(branchName)}>{branchName}</button>)}
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="Filter by class">
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {loadingStudents ? <div className="student-grid"><div className="empty">Reading the latest student register…</div></div> : filteredStudents.length === 0 ? <div className="empty">No profiles match this edition of the search.</div> : (
          <div className="student-grid">
            {featuredStudent && <article className="featured-card" key={featuredStudent.id} onClick={() => openStudentProfile(featuredStudent)}>
              <div className="featured-header"><span className="story-label">Featured Profile · 01</span><span className="popular-badge">Student Spotlight</span></div>
              <div className="featured-layout">
                <div className="featured-profile">
                  <div className="featured-inner">
                    <div className="photo-frame"><div className="avatar large">{featuredStudent.photo_url ? <img className="avatar-image" src={featuredStudent.photo_url} alt={`${featuredStudent.name} profile`} /> : getInitial(featuredStudent.name)}</div>{!featuredStudent.photo_url && <small className="photo-status">Image not uploaded</small>}</div>
                    <div><h3>{featuredStudent.name}</h3><p className="student-info">{featuredStudent.branch} · Class {featuredStudent.year}</p></div>
                  </div>
                  <p className="featured-copy">A student profile from the front page of this week's campus register.</p>
                </div>
                <div className="featured-story">
                  <div className="story-preview"><span>My Chapter</span><p>{getStudentStory(featuredStudent.id) || "No chapter published yet."}</p></div>
                  <div className="skills">{featuredStudent.skills?.split(",").slice(0, 5).map((skill, index) => <span className="skill-tag" key={`${featuredStudent.id}-${index}`}>{skill.trim()}</span>)}</div>
                </div>
              </div>
              <div className="card-footer"><span>Read profile →</span>{(currentUser?.id === featuredStudent.user_id || isAdmin) && <button className="card-edit-btn" type="button" onClick={(event) => { event.stopPropagation(); startEdit(featuredStudent); }}>{isAdmin && currentUser?.id !== featuredStudent.user_id ? "Admin Edit" : "Edit Profile"}</button>}</div>
            </article>}
            {otherStudents.map((student, index) => <article className={`student-card ${index % 2 ? "paper-alt" : ""}`} key={student.id} onClick={() => openStudentProfile(student)}>
              <span className="student-id">No. {index + 2}</span>
              <div className="card-top"><div className="photo-frame"><div className="avatar">{student.photo_url ? <img className="avatar-image" src={student.photo_url} alt={`${student.name} profile`} /> : getInitial(student.name)}</div>{!student.photo_url && <small className="photo-status">Image not uploaded</small>}</div><div className="meta"><h3>{student.name}</h3><p className="student-info">{student.branch} · Class {student.year}</p></div></div>
              <div className="story-preview"><span>My Chapter</span><p>{getStudentStory(student.id) || "No chapter published yet."}</p></div>
              <div className="skills">{student.skills?.split(",").slice(0, 5).map((skill, skillIndex) => <span className="skill-tag" key={`${student.id}-${skillIndex}`}>{skill.trim()}</span>)}</div>
              <div className="card-footer"><span>View profile →</span>{(currentUser?.id === student.user_id || isAdmin) && <button className="card-edit-btn" type="button" onClick={(event) => { event.stopPropagation(); startEdit(student); }}>{isAdmin && currentUser?.id !== student.user_id ? "Admin Edit" : "Edit Profile"}</button>}</div>
            </article>)}
          </div>
        )}

        {displayedStudents.length > DIRECTORY_PAGE_SIZE && <div className="directory-pagination" aria-label="Student directory pages">
          <span>Showing {(visiblePage - 1) * DIRECTORY_PAGE_SIZE + 1}–{Math.min(visiblePage * DIRECTORY_PAGE_SIZE, displayedStudents.length)} of {displayedStudents.length}</span>
          <div className="pagination-actions"><button type="button" onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))} disabled={visiblePage === 1}>Previous</button><strong>Page {visiblePage} / {totalDirectoryPages}</strong><button type="button" onClick={() => setDirectoryPage((page) => Math.min(totalDirectoryPages, page + 1))} disabled={visiblePage === totalDirectoryPages}>Next</button></div>
        </div>}

        {students.length > 0 && <aside className="pull-quote"><span>“</span><p>{latestSkillBlurb || "Curiosity, collaboration, and code."}</p><small>— skills on record</small></aside>}

        <section className="profile-form-wrap" ref={profileRef}>
          {currentUser && (!loggedInStudent || editingId) ? <form className="profile-form card" onSubmit={editingId ? handleUpdate : handleSave}>
            <p className="section-kicker">Personal Listing · {editingId ? "Correction" : "New Entry"}</p>
            <h3>{editingId ? "Edit Profile" : "Create Your Profile"}</h3>
            <p className="form-intro">Your listing is yours to maintain. Other students can read it; only you can edit or remove it through the app's ownership rules.</p>
            <div className="form-grid">
              <div><label>Full Name</label><input type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label>Profile Photo · crop before upload · max 50 KB</label><input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} />{photoPreviewUrl && <div className="crop-tools"><div className="crop-preview"><img src={photoPreviewUrl} alt="Crop preview" style={{ objectPosition: `${photoCropX}% ${photoCropY}%`, transform: `scale(${photoZoom})` }} /></div><label>Zoom <input type="range" min="1" max="2.5" step="0.05" value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} /></label><label>Horizontal <input type="range" min="0" max="100" value={photoCropX} onChange={(e) => setPhotoCropX(Number(e.target.value))} /></label><label>Vertical <input type="range" min="0" max="100" value={photoCropY} onChange={(e) => setPhotoCropY(Number(e.target.value))} /></label></div>}</div>
              <div><label>Branch</label><input type="text" placeholder="Computer Science, ECE, etc." value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
              <div><label>Class</label><input type="number" min="1" max="4" placeholder="1, 2, 3, 4" value={year} onChange={(e) => setYear(e.target.value)} /></div>
              <div><label>Skills · comma separated</label><input type="text" placeholder="React, Python, C++" value={skills} onChange={(e) => setSkills(e.target.value)} /></div>
            </div>
            <div className="form-actions"><button className="btn primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : editingId ? "Publish Correction" : "Publish Profile"}</button>{editingId && <button type="button" className="btn" onClick={() => { resetForm(); showMessage("info", "Edit cancelled."); }}>Cancel Edit</button>}</div>
          </form> : loggedInStudent ? <div className="profile-published card"><div><p className="section-kicker">Personal Listing</p><h3>Your profile is published</h3><p>Use Edit Profile on your student card or below to update your record.</p></div><button className="btn primary" type="button" onClick={() => startEdit(loggedInStudent)}>Edit Profile</button></div> : <div className="signin-cta card"><div><p className="section-kicker">Personal Listing</p><h3>Sign in to enter the register</h3><p>Only authenticated students can create or manage their own profile.</p></div><button className="btn primary" onClick={() => { setAuthMode("login"); setIsAuthOpen(true); }}>Login / Signup</button></div>}
        </section>

        <footer className="notice-footer"><div><strong>NOTICE</strong> अभिलेख · Student Record Management System · @EST. 2026.</div><div> Crafted with curiosity,</div><div>Corrections and profile changes are reflected from the live database.</div><section className="suggestion-footer"><p className="section-kicker">Have a suggestion? Mail to Kunwar!</p><a className="admin-email-link" href="#suggestion" onClick={(event) => { event.preventDefault(); setIsSuggestionOpen(true); }}>Email the admin</a></section></footer>
      </main>

      {selectedArticle && <section className="article-page" aria-label="Article reading page">
        <div className="article-page-inner">
          <button className="article-back" type="button" onClick={() => setSelectedArticle(null)}>← Back to Home</button>
          <div className="article-page-kicker">{selectedArticle.category} · The अभिलेख</div>
          <h2>{selectedArticle.title}</h2>
          <p className="article-page-summary">{selectedArticle.summary}</p>
          <div className="article-page-image" style={{ backgroundImage: `url(${selectedArticle.image})` }} aria-label={selectedArticle.title} role="img" />
          <div className="article-page-copy">
            <p>{selectedArticle.body}</p>
            <p className="article-page-note">Filed for the campus record · The अभिलेख</p>
          </div>
        </div>
      </section>}

      {selectedStudent && <div className="modal-backdrop profile-backdrop" onClick={() => setSelectedStudent(null)}><article className="student-modal card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelectedStudent(null)}>×</button>
        <span className="story-label">Student Profile</span>
        <div className="modal-profile-head"><div className="photo-frame"><div className="avatar large">{selectedStudent.photo_url ? <img className="avatar-image" src={selectedStudent.photo_url} alt={`${selectedStudent.name} profile`} /> : getInitial(selectedStudent.name)}</div>{!selectedStudent.photo_url && <small className="photo-status">Image not uploaded</small>}</div><div><h3>{selectedStudent.name}</h3><p className="student-info">{selectedStudent.branch} · Class {selectedStudent.year}</p></div></div>
        <div className="modal-section"><span>Skills on record</span><div className="skills">{selectedStudent.skills?.split(",").map((skill, index) => <span className="skill-tag" key={index}>{skill.trim()}</span>)}</div></div>
        <div className="modal-section story-editor"><span>My Chapter</span><p className="story-full">{getStudentStory(selectedStudent.id) || "This student has not published a chapter yet."}</p>{(currentUser?.id === selectedStudent.user_id || isAdmin) && <><textarea value={storyDraft} onChange={(e) => setStoryDraft(e.target.value)} maxLength="800" placeholder="Write a short story about your campus journey..." /><div className="story-editor-footer"><small>{storyDraft.length}/800</small><button className="btn primary" type="button" onClick={saveStudentStory} disabled={storySaving}>{storySaving ? "Saving…" : "Save story"}</button></div></>}</div>
        {(currentUser?.id === selectedStudent.user_id || isAdmin) && <div className="card-actions"><button className="btn" onClick={() => startEdit(selectedStudent)}>{isAdmin && currentUser?.id !== selectedStudent.user_id ? "Admin Edit" : "Edit"}</button><button className="btn danger" onClick={() => handleDelete(selectedStudent.id)}>Delete</button></div>}
      </article></div>}

      {isAuthOpen && <div className="modal-backdrop" onClick={() => setIsAuthOpen(false)}><div className="auth-modal card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setIsAuthOpen(false)}>×</button><p className="section-kicker">Member Access</p><h3>{authMode === "login" ? "Login" : "Sign Up"}</h3><p className="modal-subtitle">Access your place in the Student Hub register.</p>
        <form onSubmit={authMode === "login" ? handleLogin : handleSignup}><label>Email</label><input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /><label>Password</label><input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="form-actions"><button className="btn primary" type="submit" disabled={authLoading}>{authLoading ? "Please wait…" : authMode === "login" ? "Login" : "Sign Up"}</button><button type="button" className="btn" onClick={() => setAuthMode((prev) => prev === "login" ? "signup" : "login")}>{authMode === "login" ? "Create account" : "Have an account? Login"}</button></div></form>
      </div></div>}

      {isSuggestionOpen && <div className="modal-backdrop" onClick={() => setIsSuggestionOpen(false)}><div className="suggestion-modal card" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setIsSuggestionOpen(false)}>×</button><p className="section-kicker">Write to the admin</p><h3>Share a suggestion</h3><p className="modal-subtitle">Your email app will open with the project subject already filled in.</p><form onSubmit={handleSuggestionSubmit}><input name="suggestion-name" type="text" defaultValue={suggestionName} placeholder="Your name" /><input name="suggestion-email" type="email" placeholder="Your email" /><textarea name="suggestion-message" required placeholder="Write your suggestion..."></textarea><button className="btn primary" type="submit">Open email</button></form></div></div>}

      {message.text && <div className={`toast ${message.type}`}>{message.text}</div>}
    </div>
  );
}

export default App;
