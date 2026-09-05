package user

import (
	"context"
	"fmt"
	"log"
)

// AdvanceSemesters increments the semester by 1 for all active students.
// If a student's semester is 8, it graduates them (sets status to 'graduated').
func (s *Service) AdvanceSemesters(ctx context.Context, actorID string) (int, error) {
	// Let's fetch all active students
	f := ListFilter{
		UserType: "student",
		Status:   "active",
		Limit:    10000,
	}

	result, err := s.List(ctx, f)
	if err != nil {
		return 0, fmt.Errorf("failed to list students: %w", err)
	}

	updatedCount := 0

	for _, u := range result.Users {
		var semInt int
		if u.Profile != nil && u.Profile.Semester != "" {
			fmt.Sscanf(u.Profile.Semester, "%d", &semInt)
		}

		if semInt >= 1 && semInt < 8 {
			// Increment semester
			newSem := fmt.Sprintf("%d", semInt+1)
			
			// Get profile and update it
			req := UpdateUserRequest{
				Profile: &ProfileRequest{
					Semester: newSem,
				},
			}
			
			if _, err := s.Update(ctx, actorID, u.ID, req); err != nil {
				log.Printf("failed to update semester for user %s: %v", u.ID, err)
				continue
			}
			updatedCount++
		} else if semInt >= 8 {
			// Graduate the student
			if err := s.Deactivate(ctx, actorID, u.ID, "semester_advance"); err != nil {
				log.Printf("failed to graduate user %s: %v", u.ID, err)
				continue
			}
			updatedCount++
		}
	}

	return updatedCount, nil
}
