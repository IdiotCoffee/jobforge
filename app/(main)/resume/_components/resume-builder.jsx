"use client";

import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Download,
  Edit,
  Loader2,
  Monitor,
  Save,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MDEditor from "@uiw/react-md-editor";

import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resumeSchema } from "@/app/lib/schema";
import useFetch from "@/hooks/use-fetch";
import { improveSummary, saveResume } from "@/actions/resume";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EntryForm from "./entry-form";
import { toast } from "sonner";
import entriesToMarkDown from "@/app/lib/helper";
import entriesToMarkdown from "@/app/lib/helper";
import { useUser } from "@clerk/nextjs";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

const ResumeBuilder = ({ initialContent }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [lastImprovedType, setLastImprovedType] = useState(null);
  const [resumeMode, setResumeMode] = useState("preview");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useUser();

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      contactInfo: {},
      summary: "",
      skills: "",
      experience: [],
      education: [],
      projects: [],
    },
  });

  const {
    loading: isSaving,
    fn: saveResumeFn,
    data: saveResult,
    error: saveError,
  } = useFetch(saveResume);

  const {
    loading: isImproving,
    fn: improveWAIfn,
    data: improvedContent,
    error: improveError,
  } = useFetch(improveSummary);
  const formValues = watch();

  useEffect(() => {
    if (initialContent) setActiveTab("preview");
  }, [initialContent]);
  useEffect(() => {
    if (improvedContent && !isImproving) {
      // Determine which field to update based on the last used type
      if (lastImprovedType === "summary") {
        setValue("summary", improvedContent);
        toast.success("Summary improved successfully");
      } else if (lastImprovedType === "skills") {
        setValue("skills", improvedContent);
        toast.success("Skills improved successfully");
      }
    }
  }, [improvedContent, isImproving, setValue, lastImprovedType]);

  useEffect(() => {
    if (activeTab === "edit") {
      const newContent = getCombinedContent();
      setPreviewContent(newContent ? newContent : initialContent);
    }
  }, [formValues, activeTab]);



  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const element = document.getElementById("resume-pdf");
      if (!element) throw new Error("Resume PDF element not found");

      // Clone element to avoid modifying the original
      const clonedElement = element.cloneNode(true);
      clonedElement.style.position = "absolute";
      clonedElement.style.left = "-9999px";
      clonedElement.style.width = "794px"; // A4 width in pixels at 96 DPI
      clonedElement.style.visibility = "visible";
      clonedElement.style.display = "block";
      clonedElement.style.background = "white"; // Prevents any black artifacts
      document.body.appendChild(clonedElement);

      // Capture high-quality canvas
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: null, // Removes extra black background
        logging: false,
        windowWidth: clonedElement.scrollWidth,
        windowHeight: clonedElement.scrollHeight,
      });

      document.body.removeChild(clonedElement);

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Generated canvas has zero dimensions");
      }

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      if (!imgData || imgData === "data:,")
        throw new Error("Failed to generate image data");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate content height to avoid extra blank space
      const contentHeight = Math.min(
        canvas.height,
        canvas.height -
          canvas
            .getContext("2d")
            .getImageData(0, canvas.height - 1, canvas.width, 1)
            .data.findIndex((alpha) => alpha > 0)
      );

      const imgWidth = pageWidth - 20; // Leave margins
      let yPos = 0;
      let page = 0;

      while (yPos < contentHeight) {
        const pageCanvas = document.createElement("canvas");
        const context = pageCanvas.getContext("2d");

        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(
          pageHeight * (canvas.width / pageWidth),
          contentHeight - yPos
        ); // Avoid extra blank pages

        context.drawImage(
          canvas,
          0,
          yPos,
          canvas.width,
          pageCanvas.height,
          0,
          0,
          canvas.width,
          pageCanvas.height
        );

        const imgDataPart = pageCanvas.toDataURL("image/jpeg", 1.0);

        if (page > 0) pdf.addPage();
        pdf.addImage(
          imgDataPart,
          "JPEG",
          10,
          10,
          imgWidth,
          (pageCanvas.height * imgWidth) / canvas.width
        );

        yPos += pageCanvas.height;
        page++;
      }

      // Extract and embed clickable links
      const links = element.querySelectorAll("a");
      links.forEach((link) => {
        const rect = link.getBoundingClientRect();
        const url = link.href;
        if (url) {
          pdf.link(10, rect.top + 10, imgWidth, 5, { url });
        }
      });

      pdf.save("resume.pdf");
    } catch (error) {
      console.error("Detailed PDF Generation Error:", error);
      toast.error(`Failed to generate PDF: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };


  const getContactMarkdown = () => {
    const { contactInfo } = formValues;

    const parts = [];
    if (contactInfo.email) parts.push(`Email: ${contactInfo.email}`);
    if (contactInfo.mobile) parts.push(`Phone: ${contactInfo.mobile}`);
    if (contactInfo.linkedin)
      parts.push(`LinkedIn [LinkedIn](${contactInfo.linkedIn})`);
    if (contactInfo.twitter)
      parts.push(`Twitter: [Twitter](${contactInfo.twitter})`);

    return parts.length > 0
      ? `## <div align="center">${user.fullName}</div>
        \n\n<div align="center">\n\n${parts.join(" | ")}\n\n</div>`
      : "";
  };
  const getCombinedContent = () => {
    const { summary, skills, experience, education, projects } = formValues;

    return [
      getContactMarkdown(),
      summary && `## Professional Summary\n\n${summary}`,
      skills && `## Skills\n\n${skills}`,
      entriesToMarkdown(experience, "Work Experience"),
      entriesToMarkdown(education, "Education"),
      entriesToMarkdown(projects, "Projects"),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const onSubmit = async (data) => {
    try {
      // Generate the most up-to-date content before saving
      const currentContent = getCombinedContent();

      // Format the content properly
      const formattedContent = currentContent
        .replace(/\n/g, "\n") // Normalize newlines
        .replace(/\n\s*\n/g, "\n\n") // Normalize multiple newlines to double newlines
        .trim();

      console.log("Saving content:", formattedContent);

      // Save the formatted content
      await saveResumeFn(formattedContent);

      if (!saveError) {
        toast.success("Resume saved successfully");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save resume");
    }
  };

  // Ensure previewContent is always up to date
  useEffect(() => {
    const newContent = getCombinedContent();
    if (newContent) {
      setPreviewContent(newContent);
    }
  }, [formValues]);
  const handleImproveDescription = async (type) => {
    const description = watch(type);
    console.log(`Improving ${type}:`, description);

    if (!description) {
      toast.error(`Please enter a ${type} first`);
      return;
    }

    // Set the last improved type before calling the improvement function
    setLastImprovedType(type);


    try {
      const improved = await improveWAIfn({
        current: description,
        type: type.toLowerCase(),
      });

      console.log("Improvement result:", improved);

      // Directly log the type and improved content
      console.log(`Improved ${type}:`, improved);
    } catch (error) {
      console.error("Improvement error:", error);
      toast.error(`Failed to improve ${type}`);
      setLastImprovedType(null);
    }
  };

  useEffect(() => {
    if (saveResult && !isSaving) {
      toast.success("Resume saved successfully!");
    }
    if (saveError) {
      toast.error(saveError.message || "Failed to save resume");
    }
  }, [saveResult, saveError, isSaving]);
  

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <h1 className="font-bold gradient-title text-5xl md:text-6xl">
          Resume Builder
        </h1>

        <div className="space-x-2">
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Download className="h-4 2-4" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Details</TabsTrigger>
          <TabsTrigger value="preview">Markdown</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <form className="space-y-8" onSubmit={onSubmit}>
            <h3 className="text-lg font-medium">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <label className="text-lg font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="johndoe@gmail.com"
                  error={errors.contactInfo?.email}
                  {...register("contactInfo.email")}
                />
                {errors.contactInfo?.email && (
                  <p className="text-sm text-red-500">
                    {errors.contactInfo.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-lg font-medium">Mobile Number</label>
                <Input
                  type="tel"
                  placeholder="+1 234 567 8900"
                  error={errors.contactInfo?.mobile}
                  {...register("contactInfo.mobile")}
                />
                {errors.contactInfo?.mobile && (
                  <p className="text-sm text-red-500">
                    {errors.contactInfo.mobile.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-lg font-medium">LinkedIn URL</label>
                <Input
                  type="url"
                  placeholder="https://linkedin.com/your-profile"
                  error={errors.contactInfo?.linkedIn}
                  {...register("contactInfo.linkedIn")}
                />
                {errors.contactInfo?.linkedIn && (
                  <p className="text-sm text-red-500">
                    {errors.contactInfo.linkedIn.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-lg font-medium">Twitter Profile</label>
                <Input
                  type="url"
                  placeholder="https://twitter.com/your-handle"
                  error={errors.contactInfo?.twitter}
                  {...register("contactInfo.twitter")}
                />
                {errors.contactInfo?.twitter && (
                  <p className="text-sm text-red-500">
                    {errors.contactInfo.twitter.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Professional Summary</h3>
              <Controller
                name="summary"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    className="h-32"
                    placeholder="Write a compelling professional summary..."
                    error={errors.summary}
                  />
                )}
              />
              {errors.summary && (
                <p className="text-sm text-red-500">{errors.summary.message}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleImproveDescription("summary")}
                disabled={isImproving || !watch("summary")}
              >
                {isImproving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Improve with AI
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Skills</h3>
              <Controller
                name="skills"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    className="h-32"
                    placeholder="List your key skills"
                    error={errors.skills}
                  />
                )}
              />
              {errors.skills && (
                <p className="text-sm text-red-500">{errors.skills.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Work Experience</h3>
              <Controller
                name="experience"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Experience"
                    entry={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.experience && (
                <p className="text-sm text-red-500">
                  {errors.experience.message}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Education</h3>
              <Controller
                name="education"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Education"
                    entry={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.education && (
                <p className="text-sm text-red-500">
                  {errors.education.message}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Projects</h3>
              <Controller
                name="projects"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Project"
                    entry={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.projects && (
                <p className="text-sm text-red-500">
                  {errors.projects.message}
                </p>
              )}
            </div>
          </form>
        </TabsContent>
        <TabsContent value="preview">
          <Button
            variant="link"
            type="button"
            className="mb-2"
            onClick={() =>
              setResumeMode(resumeMode === "preview" ? "edit" : "preview")
            }
          >
            {resumeMode === "preview" ? (
              <>
                <Edit className="h-4 w-4" />
                Edit Resume
              </>
            ) : (
              <>
                <Monitor className="h-4 w-4" /> Show Preview
              </>
            )}
          </Button>
          {activeTab === "preview" && resumeMode !== "preview" && (
            <div className="flex p-3 gap-2 items-center border-2 border-yellow-600 text-yellow-600 rounded mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">
                You will lose editied markdown if you update the form data.
              </span>
            </div>
          )}

          <div className="border rounded-lg">
            <MDEditor
              value={previewContent}
              onChange={setPreviewContent}
              height={800}
              preview={resumeMode}
            />
          </div>
          <div className="hidden">
            <div id="resume-pdf">
              <MDEditor.Markdown
                source={previewContent}
                style={{
                  background: "white",
                  color: "black",
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResumeBuilder;
