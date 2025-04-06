import Link from "next/link";
import CoverLetterPreview from "../_components/cover-letter-preview";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getCoverLetter } from "@/actions/cover-letter";

const CoverLetter = async({params}) => {
    const id = await params.id
    const coverLetter = await getCoverLetter(id)
  return (
    <div>
      <Link href="/ai-cover-letter">
        <Button variant="link" className="gap-2 pl-0">
          <ArrowLeft className="h-4 w-4" />
          Back to Cover Letters
        </Button>
      </Link>

      <CoverLetterPreview content={coverLetter?.content} />
    </div>
  );
}

export default CoverLetter