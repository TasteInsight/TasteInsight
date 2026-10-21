ALTER TABLE "reports"
  DROP CONSTRAINT "reports_reviewId_fkey",
  DROP CONSTRAINT "reports_commentId_fkey",
  DROP CONSTRAINT "reports_postId_fkey",
  DROP CONSTRAINT "reports_postCommentId_fkey",
  ADD CONSTRAINT "reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "reports_postCommentId_fkey" FOREIGN KEY ("postCommentId") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
