import { LoaderIcon } from "lucide-react";

/**
 * Spinner component displayed while components are loading.
 */
const PageLoader = () => {
  return (
    <div className="flex justify-center items-center h-screen">
      <LoaderIcon className="animate-spin size-10 text-primary" />
    </div>
  );
};

export default PageLoader;
